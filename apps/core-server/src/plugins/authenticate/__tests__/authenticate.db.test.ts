// Stage 4 on real sessions, against PostgreSQL (plan row W24; HB-5; spec §4.1, §5.2 ID-12,
// ID-13, §5.3; SR-13, SR-73, SR-75; AC-B-81; decisions D69, D72). A clone of the seed template,
// the code under test as `dems_app`, the real stages 3, 4 and 5, no listener.
//
// The sessions are issued by the real sign-in. The device registry is plan row W32's: behind
// its seam stands a double that knows the test's devices; one block runs with the pairing
// module's own resolver, for which the test's device (a row without a credential row) is none.
import { DEMO_OPERATOR_PASSWORD, OPERATOR_IDS, OPERATORS } from '@dems/shared/sim';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readTrail } from '../../../../test/support/core';
import {
  CLOCK_START,
  OWN_ORIGIN,
  SESSION,
  SIGN_IN,
  SIGN_OUT,
  STATUS,
  TOUCH,
  WEB_ORIGIN,
  bearer,
  closeOpenSessions,
  deviceRegistryDouble,
  deviceSignIn,
  errorOf,
  forgetCounters,
  get,
  identityApp,
  insertPairedDevice,
  sessionOfToken,
  signInOnWeb,
  storedSessions,
  webSignIn,
  type DeviceRegistryDouble,
  type IdentityApp,
  type WebSession,
} from '../../../../test/support/identity';
import { throttleControl } from '../../throttle';
import { authenticationOf, type Principal } from '../index';

const db = useTestDatabase({ template: 'seed' });
let identity: IdentityApp;
let owner: Pool;
let devices: DeviceRegistryDouble;
let deviceCredential: string;

const INVESTIGATOR = OPERATORS[0]!;
const SUPERVISOR = OPERATORS[1]!;
const DEVICE = 'DEV-0001';
const WHO = '/api/v1/scratch/who';

interface Who {
  principal: Principal;
  presented: string;
  failure: string | null;
}

beforeAll(async () => {
  owner = db.ownerPool();
  identity = await identityApp(db, {
    routes: (app) => {
      const who = async (request: Parameters<typeof authenticationOf>[0]): Promise<Who> => {
        const { presented, failure } = authenticationOf(request);
        return { principal: request.principal, presented, failure };
      };
      app.get(WHO, { config: { operationId: 'scratchWho' } }, who);
      app.post(WHO, { config: { operationId: 'scratchWhoCommand' } }, who);
    },
  });
  devices = deviceRegistryDouble();
  identity.app.seams.replace('deviceResolver', devices.resolver);
  await insertPairedDevice(owner, DEVICE, OPERATOR_IDS.ANDI, CLOCK_START);
  deviceCredential = devices.pair(DEVICE);
});

beforeEach(async () => {
  await closeOpenSessions(owner);
  forgetCounters(identity);
});

const who = async (headers: Record<string, string>): Promise<Who> => (await get(identity.app, WHO, headers)).json() as Who;
const deviceToken = async (username: string): Promise<string> =>
  ((await deviceSignIn(identity.app, deviceCredential, username)).json() as { sessionToken: string }).sessionToken;
const trailLength = async (): Promise<number> => (await readTrail(owner)).length;

describe('a session is bound to its transport (ID-13, AC-B-81)', () => {
  it('the cookie resolves a web session; a bearer value resolves a device session; neither resolves the other\'s', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const token = await deviceToken(INVESTIGATOR.username);
    const webSession = await sessionOfToken(owner, web.token);
    const deviceSession = await sessionOfToken(owner, token);

    expect(await who(web.cookie)).toEqual({
      principal: {
        kind: 'OPERATOR',
        operatorId: SUPERVISOR.id,
        sessionId: webSession.id,
        deviceId: null,
        role: 'SUPERVISOR',
        permissions: expect.arrayContaining(['USER_ADMIN', 'PAIRING_MANAGE', 'DEMO_CONTROL']) as unknown,
      },
      presented: 'COOKIE',
      failure: null,
    });
    expect(await who(bearer(token))).toMatchObject({
      principal: { kind: 'OPERATOR', operatorId: INVESTIGATOR.id, sessionId: deviceSession.id, deviceId: DEVICE, role: 'INVESTIGATOR' },
      presented: 'BEARER',
      failure: null,
    });

    // The misuse cells of AC-B-81: no principal, and no row changes.
    const before = await storedSessions(owner);
    const trail = await trailLength();
    expect(await who({ cookie: `${identity.cookieName}=${token}` })).toEqual({
      principal: { kind: 'ANONYMOUS', retiredDeviceId: null },
      presented: 'COOKIE',
      failure: 'UNKNOWN',
    });
    expect(await who(bearer(web.token))).toEqual({ principal: { kind: 'ANONYMOUS', retiredDeviceId: null }, presented: 'BEARER', failure: 'UNKNOWN' });
    for (const headers of [{ cookie: `${identity.cookieName}=${token}` }, bearer(web.token)]) {
      const refused = await get(identity.app, SESSION, headers);
      expect([refused.statusCode, errorOf(refused).code]).toEqual([401, 'NOT_SIGNED_IN']);
    }
    expect(await storedSessions(owner)).toEqual(before);
    expect(await trailLength()).toBe(trail);
  });

  it('the lookup itself is bound to the transport (database contract §5.2): each token is found on its own transport only', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const token = await deviceToken(INVESTIGATOR.username);
    const registry = identity.app.sessionRegistry;
    expect((await registry.resolve(web.token, 'COOKIE')).status).toBe('OPEN');
    expect(await registry.resolve(web.token, 'BEARER')).toEqual({ status: 'UNKNOWN' });
    expect((await registry.resolve(token, 'BEARER')).status).toBe('OPEN');
    expect(await registry.resolve(token, 'COOKIE')).toEqual({ status: 'UNKNOWN' });
  });

  it('a device credential resolves to DEVICE while paired, and to the device ID only once it is retired', async () => {
    expect(await who(bearer(deviceCredential))).toEqual({ principal: { kind: 'DEVICE', deviceId: DEVICE }, presented: 'BEARER', failure: null });

    await insertPairedDevice(owner, 'DEV-0005', OPERATOR_IDS.ANDI, CLOCK_START);
    const credential = devices.pair('DEV-0005');
    const token = ((await deviceSignIn(identity.app, credential, SUPERVISOR.username)).json() as { sessionToken: string }).sessionToken;
    expect((await who(bearer(token))).principal).toMatchObject({ kind: 'OPERATOR', deviceId: 'DEV-0005' });

    devices.retire('DEV-0005');
    const retired = { principal: { kind: 'ANONYMOUS', retiredDeviceId: 'DEV-0005' }, presented: 'BEARER', failure: 'DEVICE_RETIRED' };
    expect(await who(bearer(credential))).toEqual(retired);
    // Its session token too, although the session row is still open: the device decides.
    expect(await who(bearer(token))).toEqual(retired);
    expect(await sessionOfToken(owner, token)).toMatchObject({ endedAt: null });
  });
});

describe('SR-15, SR-38: a credential is read from the cookie or the Authorization header, and from nowhere else', () => {
  it('a valid token in the query string, in another header or in the body authenticates nothing', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const token = await deviceToken(INVESTIGATOR.username);
    const anonymous = { principal: { kind: 'ANONYMOUS', retiredDeviceId: null }, presented: 'NONE', failure: null };
    for (const value of [web.token, token]) {
      expect((await get(identity.app, `${WHO}?token=${value}&${identity.cookieName}=${value}&access_token=${value}`, {})).json()).toEqual(anonymous);
      expect((await get(identity.app, WHO, { 'x-session-token': value, 'x-authorization': `Bearer ${value}`, 'proxy-authorization': `Bearer ${value}` })).json()).toEqual(anonymous);
      const posted = await identity.app.inject({ method: 'POST', url: WHO, payload: { token: value, sessionToken: value } });
      expect(posted.json()).toEqual(anonymous);
      expect((await get(identity.app, `${SESSION}?token=${value}`, {})).statusCode).toBe(401);
    }
  });
});

// Until the pairing row landed this block ran with the seam unfilled (the scaffold's stub denied
// everything). The seam is filled now (decision D93), and the block passes for another reason,
// which is what it is named after since fix round B1: the app below keeps the pairing module's
// REAL resolver, and the test's device is a `paired_devices` row without a `device_credentials`
// row (`insertPairedDevice`), whose credential only the double of the other app knows. The
// resolver's own answer for such a row is tested in `modules/pairing/__tests__/devices.db.test.ts`
// ("a device row without its credential row ..."); here it is what stage 4 and stage 6 make of
// it for a real, open session of that device.
describe('the pairing module\'s own resolver behind the seam deviceResolver: a device row without its credential row', () => {
  it('is no device: a credential the registry does not store and an open session of that device resolve to nothing, and it cannot sign in', async () => {
    const token = await deviceToken(SUPERVISOR.username);
    const real = await identityApp(db, {
      routes: (app) => {
        app.get(WHO, async (request) => ({ principal: request.principal, ...authenticationOf(request) }));
      },
    });
    const answer = async (headers: Record<string, string>): Promise<Who> => (await get(real.app, WHO, headers)).json() as Who;
    expect(await answer(bearer(deviceCredential))).toMatchObject({ principal: { kind: 'ANONYMOUS', retiredDeviceId: null }, failure: 'UNKNOWN' });
    expect(await answer(bearer(token))).toMatchObject({ principal: { kind: 'ANONYMOUS', retiredDeviceId: null }, failure: 'DEVICE_UNKNOWN' });
    // So a device signs in only with a credential the registry itself stores.
    const refused = await deviceSignIn(real.app, deviceCredential, SUPERVISOR.username);
    expect([refused.statusCode, errorOf(refused).code]).toEqual([403, 'DEVICE_NOT_PAIRED']);
    await real.app.close();
  });
});

describe('ID-12 through the real stage 4 (decision D72): this instance\'s cookie AND a bearer value', () => {
  let web: WebSession;
  let token: string;

  beforeEach(async () => {
    web = await signInOnWeb(identity, SUPERVISOR.username);
    token = await deviceToken(INVESTIGATOR.username);
  });

  const shapes = (): ReadonlyArray<readonly [name: string, request: InjectOptions]> => {
    const both = { ...web.cookie, ...bearer(token) };
    return [
      ['no Origin, GET', { method: 'GET', url: SESSION, headers: both }],
      ['a web console origin, GET', { method: 'GET', url: SESSION, headers: { ...both, origin: WEB_ORIGIN } }],
      ['a web console origin, POST', { method: 'POST', url: TOUCH, headers: { ...both, origin: WEB_ORIGIN } }],
      ['a web console origin, POST signOut', { method: 'POST', url: SIGN_OUT, headers: { ...both, origin: WEB_ORIGIN } }],
      ['a web console origin, POST signIn', { method: 'POST', url: SIGN_IN, headers: { ...both, origin: WEB_ORIGIN }, payload: { username: 'x', password: 'y' } }],
    ];
  };

  it('answers 401 CREDENTIAL_CONFLICT on every request shape; no audit row, no place in the denial budget, no Set-Cookie, and both sessions stay as they are', async () => {
    const trail = await trailLength();
    const sessions = await storedSessions(owner);
    identity.clock.advance(120_000);

    for (const [name, request] of shapes()) {
      const response: LightMyRequestResponse = await identity.app.inject(request);
      expect(response.statusCode, name).toBe(401);
      expect(errorOf(response), name).toMatchObject({ code: 'NOT_SIGNED_IN', details: { reason: 'CREDENTIAL_CONFLICT' } });
      expect(response.headers['set-cookie'], name).toBeUndefined();
    }

    // RB-6: a 401 has no actor, so it writes no row; and what writes no row takes no budget place.
    expect(await trailLength()).toBe(trail);
    for (const key of ['class:web', 'class:local', `operator:${SUPERVISOR.id}`, `operator:${INVESTIGATOR.id}`] as const) {
      expect(await throttleControl(identity.app).inspect(key), key).toMatchObject({ used: 0, exhausted: false });
    }
    // Nothing was resolved: no activity was recorded, nothing ended.
    expect(await storedSessions(owner)).toEqual(sessions);
    // Each credential alone still works.
    expect((await get(identity.app, SESSION, web.cookie)).statusCode).toBe(200);
    expect((await get(identity.app, SESSION, bearer(token))).statusCode).toBe(200);
  });

  it('with no Origin on a POST, and with the instance\'s own origin, the Origin guard answers first (403)', async () => {
    const both = { ...web.cookie, ...bearer(token) };
    const post = await identity.app.inject({ method: 'POST', url: TOUCH, headers: both });
    expect([post.statusCode, errorOf(post).code]).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
    const own = await identity.app.inject({ method: 'GET', url: SESSION, headers: { ...both, origin: OWN_ORIGIN } });
    expect([own.statusCode, errorOf(own).code]).toEqual([403, 'ORIGIN_NOT_ALLOWED']);
  });
});

describe('D69: what a mobile app really sends', () => {
  it('a bearer request with another instance\'s cookie and an unrelated cookie resolves as the bearer session', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const token = await deviceToken(INVESTIGATOR.username);
    // The cookie store of the app's socket holds a lane's cookie; its value is even a valid token here.
    const response = await get(identity.app, SESSION, {
      ...bearer(token),
      origin: OWN_ORIGIN,
      host: '127.0.0.1:4420',
      'user-agent': 'okhttp/4.12.0',
      cookie: `dems_session_4421=${web.token}; theme=dark`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ operator: { id: INVESTIGATOR.id }, deviceId: DEVICE });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('a bearer request with this instance\'s own cookie is the 401', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const token = await deviceToken(INVESTIGATOR.username);
    const response = await get(identity.app, SESSION, { ...bearer(token), cookie: `dems_session_4421=${web.token}; ${identity.cookieName}=${web.token}` });
    expect(response.statusCode).toBe(401);
    expect(errorOf(response).details).toEqual({ reason: 'CREDENTIAL_CONFLICT' });
  });

  it('no answer to a device carries Set-Cookie: every operation of the identity core, success and refusal', async () => {
    const token = await deviceToken(INVESTIGATOR.username);
    const asDevice = bearer(deviceCredential);
    const asSession = bearer(token);
    const requests: ReadonlyArray<readonly [name: string, request: InjectOptions, status: number]> = [
      ['signIn, right password', { method: 'POST', url: SIGN_IN, headers: asDevice, payload: { username: SUPERVISOR.username, password: DEMO_OPERATOR_PASSWORD } }, 200],
      ['signIn, wrong password', { method: 'POST', url: SIGN_IN, headers: asDevice, payload: { username: SUPERVISOR.username, password: 'not-it' } }, 401],
      ['signIn, invalid body', { method: 'POST', url: SIGN_IN, headers: asDevice, payload: { username: SUPERVISOR.username } }, 422],
      ['getSignInStatus by the device', { method: 'GET', url: STATUS, headers: asDevice }, 200],
      ['getSignInStatus by its session', { method: 'GET', url: STATUS, headers: asSession }, 200],
      ['getAuthSession', { method: 'GET', url: SESSION, headers: asSession }, 200],
      ['getAuthSession with the device credential only', { method: 'GET', url: SESSION, headers: asDevice }, 401],
      ['touchSession', { method: 'POST', url: TOUCH, headers: asSession }, 200],
      ['signOut, invalid body', { method: 'POST', url: SIGN_OUT, headers: asSession, payload: { reason: 'NO' } }, 422],
      ['signOut', { method: 'POST', url: SIGN_OUT, headers: asSession }, 204],
      ['getAuthSession after the sign-out', { method: 'GET', url: SESSION, headers: asSession }, 401],
      ['signOut after the sign-out', { method: 'POST', url: SIGN_OUT, headers: asSession }, 401],
      ['signIn with an unknown credential', { method: 'POST', url: SIGN_IN, headers: bearer(`dvc_${'N'.repeat(43)}`), payload: { username: 'x', password: 'y' } }, 403],
      ['signIn without any credential', { method: 'POST', url: SIGN_IN, payload: { username: 'x', password: 'y' } }, 403],
      ['getSignInStatus without any credential', { method: 'GET', url: STATUS }, 200],
    ];
    for (const [name, request, status] of requests) {
      const response = await identity.app.inject(request);
      expect(response.statusCode, name).toBe(status);
      expect(response.headers['set-cookie'], name).toBeUndefined();
    }
    // The device console locked: 423 carries none either.
    identity.control.lockout.reset();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await deviceSignIn(identity.app, deviceCredential, SUPERVISOR.username, 'not-it');
      expect(response.headers['set-cookie']).toBeUndefined();
      if (attempt >= 4) expect(response.statusCode).toBe(423);
    }
  });

  it('on the web, only a successful sign-in sets the cookie and only a sign-out clears it', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    const without: ReadonlyArray<InjectOptions> = [
      { method: 'GET', url: SESSION, headers: web.cookie },
      { method: 'GET', url: STATUS, headers: web.cookie },
      { method: 'POST', url: TOUCH, headers: { ...web.cookie, origin: WEB_ORIGIN } },
      { method: 'GET', url: STATUS },
      { method: 'POST', url: SIGN_IN, headers: { origin: WEB_ORIGIN }, payload: { username: SUPERVISOR.username, password: 'not-it' } },
      { method: 'POST', url: SIGN_OUT, headers: { origin: WEB_ORIGIN } },
    ];
    for (const request of without) expect((await identity.app.inject(request)).headers['set-cookie']).toBeUndefined();
    expect((await webSignIn(identity.app, SUPERVISOR.username)).headers['set-cookie']).toBeDefined();
    const out = await identity.app.inject({ method: 'POST', url: SIGN_OUT, headers: { ...web.cookie, origin: WEB_ORIGIN } });
    expect(String(out.headers['set-cookie'])).toContain('Max-Age=0');
  });
});

describe('SR-75: the throttle counts a resolved principal under its own key', () => {
  it('31 reads of a signed-in operator all pass; the 31st read without a principal answers 429', async () => {
    const web = await signInOnWeb(identity, SUPERVISOR.username);
    forgetCounters(identity);
    const operator: number[] = [];
    for (let count = 0; count < 31; count += 1) operator.push((await get(identity.app, SESSION, web.cookie)).statusCode);
    expect(new Set(operator)).toEqual(new Set([200]));
    // A cookie that does not resolve is counted in the class bucket, like no credential at all.
    const anonymous: number[] = [];
    for (let count = 0; count < 31; count += 1) {
      anonymous.push((await get(identity.app, STATUS, { cookie: `${identity.cookieName}=ses_${String(count).padStart(43, 'z')}` })).statusCode);
    }
    expect(anonymous.slice(0, 30).every((status) => status === 200)).toBe(true);
    expect(anonymous[30]).toBe(429);
  });
});
