// Stage 4 of the request pipeline in the real app factory (plan row W24; HB-5; spec §2.3, §4.1,
// §5.2 ID-12, ID-13; SR-73, SR-75; AC-B-81 in unit form; decisions D69, D72). In-process:
// `app.inject`, no listener, no database: the session registry and the device registry are
// stand-ins behind their seams, so every cell of the credential decision table is one request.
// Stages 3 and 5 are the real ones. The database tests run the same stage on real sessions.
//
// Every token here is a made-up example of a FORM; none was ever issued.
import { ApiErrorSchema, CREDENTIAL_CONFLICT_REASON } from '@dems/shared/api';
import { OperatorRole, Permission, createManualClock } from '@dems/shared/sim';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../../app';
import type { OpenSession, SessionRegistry, SessionResolution, TouchOutcome } from '../../../modules/identity';
import type { ResolvedDevice } from '../../../modules/pairing';
import { captureLog, createFakePool, credentialLeaks, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { RESPONSE_HEADERS } from '../../response-headers';
import { throttleControl } from '../../throttle';
import { ACTIVITY_EXEMPT_OPERATIONS, ANONYMOUS_PRINCIPAL, authenticationOf, operatorSessionOf, type Authentication, type Principal } from '../index';

const OWN_COOKIE = 'dems_session_4420';
const WEB_ORIGIN = 'http://127.0.0.1:5173';
const OWN_ORIGIN = 'http://127.0.0.1:4420';
const CLOCK_START = Date.UTC(2031, 0, 1);

const token = (letter: string): string => `ses_${letter.repeat(43)}`;
const credential = (letter: string): string => `dvc_${letter.repeat(43)}`;

const WEB_TOKEN = token('W');
const DEVICE_TOKEN = token('D');
const ENDED_TOKEN = token('E');
const DISABLED_TOKEN = token('X');
const RETIRED_SESSION_TOKEN = token('R');
const REVOKED_SESSION_TOKEN = token('V');
const ORPHAN_TOKEN = token('O');
const UNKNOWN_TOKEN = token('U');
const PAIRED_CREDENTIAL = credential('P');
const RETIRED_CREDENTIAL = credential('Q');
const UNKNOWN_CREDENTIAL = credential('Z');

function session(id: string, deviceId: string | null): OpenSession {
  return {
    id,
    operatorId: 'OPR-002',
    deviceId,
    method: 'PASSWORD',
    issuedAt: CLOCK_START,
    lastSeenAt: CLOCK_START,
    absoluteExpiresAt: CLOCK_START + 8 * 60 * 60_000,
    operator: {
      id: 'OPR-002',
      username: 'andi.pratama',
      rank: 'AKP',
      name: 'Andi Pratama',
      displayName: 'AKP Andi Pratama',
      initials: 'AP',
      role: OperatorRole.SUPERVISOR,
    },
    permissions: [Permission.SESSION_START, Permission.USER_ADMIN],
  };
}

const WEB_SESSION = session('11111111-1111-4111-8111-111111111111', null);
const DEVICE_SESSION = session('22222222-2222-4222-8222-222222222222', 'DEV-0001');

/** What the stand-in registry answers, by transport and token: the lookup of database contract §5.2. */
const RESOLUTIONS: Readonly<Record<string, SessionResolution>> = {
  [`COOKIE ${WEB_TOKEN}`]: { status: 'OPEN', session: WEB_SESSION },
  [`COOKIE ${ENDED_TOKEN}`]: { status: 'ENDED', sessionId: 'ended', deviceId: null, endReason: 'IDLE_EXPIRED' },
  [`COOKIE ${DISABLED_TOKEN}`]: { status: 'OPERATOR_DISABLED', sessionId: 'disabled', deviceId: null },
  [`BEARER ${DEVICE_TOKEN}`]: { status: 'OPEN', session: DEVICE_SESSION },
  [`BEARER ${ENDED_TOKEN}`]: { status: 'ENDED', sessionId: 'ended', deviceId: 'DEV-0001', endReason: 'SIGNED_OUT' },
  [`BEARER ${RETIRED_SESSION_TOKEN}`]: { status: 'OPEN', session: session('33333333-3333-4333-8333-333333333333', 'DEV-0002') },
  [`BEARER ${REVOKED_SESSION_TOKEN}`]: { status: 'ENDED', sessionId: 'revoked', deviceId: 'DEV-0007', endReason: 'DEVICE_REVOKED' },
  [`BEARER ${ORPHAN_TOKEN}`]: { status: 'OPEN', session: session('44444444-4444-4444-8444-444444444444', 'DEV-0404') },
};

const DEVICES: Readonly<Record<string, ResolvedDevice>> = {
  'DEV-0001': { status: 'PAIRED', deviceId: 'DEV-0001' },
  'DEV-0002': { status: 'RETIRED', deviceId: 'DEV-0002' },
  'DEV-0003': { status: 'PAIRED', deviceId: 'DEV-0003' },
  'DEV-0004': { status: 'RETIRED', deviceId: 'DEV-0004' },
};
const CREDENTIALS: Readonly<Record<string, string>> = { [PAIRED_CREDENTIAL]: 'DEV-0003', [RETIRED_CREDENTIAL]: 'DEV-0004' };

const resolve = vi.fn(async (value: string, transport: 'COOKIE' | 'BEARER'): Promise<SessionResolution> => RESOLUTIONS[`${transport} ${value}`] ?? { status: 'UNKNOWN' });
const touch = vi.fn(async (_sessionId: string): Promise<TouchOutcome> => ({ status: 'TOUCHED', lastSeenAt: 0 }));
const resolveCredential = vi.fn(async (value: string): Promise<ResolvedDevice | null> => DEVICES[CREDENTIALS[value] ?? ''] ?? null);
const resolveDevice = vi.fn(async (deviceId: string): Promise<ResolvedDevice | null> => DEVICES[deviceId] ?? null);

const registry: SessionRegistry = {
  resolve,
  touch,
  endForOperator: async () => [],
  endForDevice: async () => [],
  endBiometricSessions: async () => [],
  sweep: async () => [],
};

interface Seen {
  principal: Principal;
  authentication: Authentication;
  throttleKey: string;
}

let app: FastifyInstance;
let log: CapturedLog;
const clock = createManualClock(CLOCK_START);
const handled = { get: 0, post: 0, signOut: 0 };
/** Calls that reached the stand-in handler of the biometric sign-in (finding F-4 of the biometric row). */
let biometricSignIns = 0;

beforeAll(async () => {
  log = captureLog();
  app = buildApp({ config: unitTestConfig({ logLevel: 'trace' }), createPool: () => createFakePool().pool, logStream: log.stream });
  const seen = (request: Parameters<typeof authenticationOf>[0]): Seen => ({
    principal: request.principal,
    authentication: authenticationOf(request),
    throttleKey: throttleControl(app).keyOf(request),
  });
  app.get('/api/v1/scratch', { config: { operationId: 'scratchRead' } }, async (request) => {
    handled.get += 1;
    return seen(request);
  });
  app.post('/api/v1/scratch', { config: { operationId: 'scratchCommand' } }, async (request) => {
    handled.post += 1;
    return seen(request);
  });
  app.post('/api/v1/scratch/sign-out', { config: { operationId: 'signOut' } }, async (request) => {
    handled.signOut += 1;
    return seen(request);
  });
  app.post('/api/v1/scratch/biometric-sign-in', { config: { operationId: 'signInWithBiometric' } }, async (request) => {
    biometricSignIns += 1;
    return seen(request);
  });
  app.get('/api/v1/scratch/operator', async (request) => ({ sessionId: operatorSessionOf(request).id }));
  await app.ready();
  // By-design change (plan row W28): not about stage 6; a scratch route is no registry operation.
  app.stages.replace('accessRule', () => {});
  app.seams.replace('clock', clock);
  app.seams.replace('sessionRegistry', registry);
  // `deviceState` is a unit's read for the biometric sign-in; stage 4 never calls it.
  app.seams.replace('deviceResolver', { resolveCredential, resolveDevice, deviceState: async () => null });
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
});

afterAll(() => app.close());

beforeEach(() => {
  vi.clearAllMocks();
  touch.mockImplementation(async () => ({ status: 'TOUCHED', lastSeenAt: clock.now() }));
  throttleControl(app).reset();
  handled.get = 0;
  handled.post = 0;
  handled.signOut = 0;
  biometricSignIns = 0;
});

const cookie = (value: string, name = OWN_COOKIE): Record<string, string> => ({ cookie: `${name}=${value}` });
const bearer = (value: string): Record<string, string> => ({ authorization: `Bearer ${value}` });
const read = (headers: Record<string, string> = {}): Promise<LightMyRequestResponse> => app.inject({ method: 'GET', url: '/api/v1/scratch', headers });
const seenBy = (response: LightMyRequestResponse): Seen => response.json() as Seen;

const ANONYMOUS = { kind: 'ANONYMOUS', retiredDeviceId: null };
const WEB_OPERATOR = {
  kind: 'OPERATOR',
  operatorId: 'OPR-002',
  sessionId: WEB_SESSION.id,
  deviceId: null,
  role: 'SUPERVISOR',
  permissions: ['SESSION_START', 'USER_ADMIN'],
};
const DEVICE_OPERATOR = { ...WEB_OPERATOR, sessionId: DEVICE_SESSION.id, deviceId: 'DEV-0001' };

describe('the credential decision table of stage 4 (spec §4.1, §2.3)', () => {
  it('C1 nothing presented: ANONYMOUS, and nothing is looked up', async () => {
    const response = await read();
    expect(response.statusCode).toBe(200);
    expect(seenBy(response)).toEqual({ principal: ANONYMOUS, authentication: { presented: 'NONE', failure: null, session: null }, throttleKey: 'class:local' });
    expect(resolve).not.toHaveBeenCalled();
    expect(resolveCredential).not.toHaveBeenCalled();
  });

  it('C2 the cookie of an open web session: OPERATOR without a device, with the role and permissions the lookup read', async () => {
    const response = await read(cookie(WEB_TOKEN));
    expect(seenBy(response).principal).toEqual(WEB_OPERATOR);
    expect(seenBy(response).authentication).toMatchObject({ presented: 'COOKIE', failure: null, session: { id: WEB_SESSION.id } });
    expect(resolve.mock.calls).toEqual([[WEB_TOKEN, 'COOKIE']]);
    expect(resolveDevice).not.toHaveBeenCalled();
  });

  it.each([
    ['C3 a cookie whose value is no token', 'not-a-token', 'MALFORMED', 0],
    ['C4 a cookie with an unknown token', UNKNOWN_TOKEN, 'UNKNOWN', 1],
    ['C5 a cookie of an ended or expired session', ENDED_TOKEN, 'ENDED', 1],
    ['C6 a cookie of a disabled operator\'s session', DISABLED_TOKEN, 'OPERATOR_DISABLED', 1],
    ['C7 a device session\'s token sent as the cookie (ID-13)', DEVICE_TOKEN, 'UNKNOWN', 1],
  ])('%s: ANONYMOUS, not refused here', async (_name, value, failure, lookups) => {
    const response = await read(cookie(value));
    expect(response.statusCode).toBe(200);
    expect(seenBy(response)).toEqual({ principal: ANONYMOUS, authentication: { presented: 'COOKIE', failure, session: null }, throttleKey: 'class:local' });
    expect(resolve).toHaveBeenCalledTimes(lookups);
    if (lookups === 1) expect(resolve.mock.calls[0]?.[1]).toBe('COOKIE');
  });

  it('C8 a bearer session token of an open session whose device is PAIRED: OPERATOR bound to the device', async () => {
    const response = await read(bearer(DEVICE_TOKEN));
    expect(seenBy(response).principal).toEqual(DEVICE_OPERATOR);
    expect(seenBy(response).authentication).toMatchObject({ presented: 'BEARER', failure: null, session: { id: DEVICE_SESSION.id, deviceId: 'DEV-0001' } });
    expect(resolve.mock.calls).toEqual([[DEVICE_TOKEN, 'BEARER']]);
    expect(resolveDevice.mock.calls).toEqual([['DEV-0001']]);
  });

  it.each([
    ['C9 an open session whose device is REVOKED or UNPAIRED', RETIRED_SESSION_TOKEN, 'DEV-0002'],
    ['C10 a session that was ended with its device (DEVICE_REVOKED)', REVOKED_SESSION_TOKEN, 'DEV-0007'],
  ])('%s: not a principal; the device ID is kept for stage 6', async (_name, value, deviceId) => {
    const response = await read(bearer(value));
    expect(seenBy(response)).toEqual({
      principal: { kind: 'ANONYMOUS', retiredDeviceId: deviceId },
      authentication: { presented: 'BEARER', failure: 'DEVICE_RETIRED', session: null },
      throttleKey: 'class:local',
    });
  });

  it.each([
    ['C11 a session whose device the registry does not know (the seam unfilled)', ORPHAN_TOKEN, 'DEVICE_UNKNOWN'],
    ['C12 an ended device session', ENDED_TOKEN, 'ENDED'],
    ['C13 a web session\'s token sent as a bearer value (ID-13)', WEB_TOKEN, 'UNKNOWN'],
    ['C14 an unknown session token', UNKNOWN_TOKEN, 'UNKNOWN'],
  ])('%s: ANONYMOUS', async (_name, value, failure) => {
    const response = await read(bearer(value));
    expect(response.statusCode).toBe(200);
    expect(seenBy(response)).toEqual({ principal: ANONYMOUS, authentication: { presented: 'BEARER', failure, session: null }, throttleKey: 'class:local' });
    expect(resolve.mock.calls).toEqual([[value, 'BEARER']]);
  });

  it('C15 a device credential of a PAIRED device: DEVICE; C16 of a retired one: the device ID only; C17 unknown: ANONYMOUS', async () => {
    const paired = seenBy(await read(bearer(PAIRED_CREDENTIAL)));
    expect(paired).toEqual({
      principal: { kind: 'DEVICE', deviceId: 'DEV-0003' },
      authentication: { presented: 'BEARER', failure: null, session: null },
      throttleKey: 'device:DEV-0003',
    });
    const retired = seenBy(await read(bearer(RETIRED_CREDENTIAL)));
    expect(retired).toEqual({
      principal: { kind: 'ANONYMOUS', retiredDeviceId: 'DEV-0004' },
      authentication: { presented: 'BEARER', failure: 'DEVICE_RETIRED', session: null },
      throttleKey: 'class:local',
    });
    const unknown = seenBy(await read(bearer(UNKNOWN_CREDENTIAL)));
    expect(unknown).toEqual({ principal: ANONYMOUS, authentication: { presented: 'BEARER', failure: 'UNKNOWN', session: null }, throttleKey: 'class:local' });
    expect(resolveCredential.mock.calls.map(([value]) => value)).toEqual([PAIRED_CREDENTIAL, RETIRED_CREDENTIAL, UNKNOWN_CREDENTIAL]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each([
    ['a biometric token', `Bearer bio_${'B'.repeat(43)}`],
    ['another scheme', 'Basic dXNlcjpwYXNz'],
    ['a value that is no token', 'Bearer made-up'],
    ['an empty header', ''],
  ])('C18 an Authorization header with %s: ANONYMOUS, and nothing is looked up', async (_name, authorization) => {
    const response = await read({ authorization });
    expect(seenBy(response)).toEqual({ principal: ANONYMOUS, authentication: { presented: 'BEARER', failure: 'MALFORMED', session: null }, throttleKey: 'class:local' });
    expect(resolve).not.toHaveBeenCalled();
    expect(resolveCredential).not.toHaveBeenCalled();
  });
});

describe('ID-12: this instance\'s cookie AND an Authorization header (D72: through the real stage 4)', () => {
  const both = { ...cookie(WEB_TOKEN), ...bearer(DEVICE_TOKEN) };
  const SHAPES: ReadonlyArray<readonly [name: string, request: InjectOptions]> = [
    ['no Origin, GET', { method: 'GET', url: '/api/v1/scratch', headers: both }],
    ['a web console origin, GET', { method: 'GET', url: '/api/v1/scratch', headers: { ...both, origin: WEB_ORIGIN } }],
    ['a web console origin, POST', { method: 'POST', url: '/api/v1/scratch', headers: { ...both, origin: WEB_ORIGIN }, payload: {} }],
  ];

  it.each(SHAPES)('%s: 401 NOT_SIGNED_IN with details.reason CREDENTIAL_CONFLICT; nothing is resolved, no row, no place in the denial budget, no Set-Cookie', async (_name, request) => {
    const units = app.pipeline.snapshot();
    const response = await app.inject(request);

    expect(response.statusCode).toBe(401);
    const { error } = ApiErrorSchema.parse(response.json());
    expect(error).toMatchObject({ code: 'NOT_SIGNED_IN', message: 'Send one credential per request.', details: { reason: CREDENTIAL_CONFLICT_REASON } });
    expect(typeof error.requestId).toBe('string');
    expect(response.headers['set-cookie']).toBeUndefined();
    for (const [name, value] of Object.entries(RESPONSE_HEADERS)) expect(response.headers[name], name).toBe(value);

    // Nothing was resolved: neither credential was looked at.
    expect(resolve).not.toHaveBeenCalled();
    expect(resolveCredential).not.toHaveBeenCalled();
    expect(resolveDevice).not.toHaveBeenCalled();
    expect(handled).toEqual({ get: 0, post: 0, signOut: 0 });
    // A 401 writes no audit row (RB-6): no unit of work ran, and no budget place was taken.
    expect(app.pipeline.snapshot()).toEqual(units);
    for (const key of ['class:web', 'class:local', 'operator:OPR-002'] as const) {
      expect(await throttleControl(app).inspect(key)).toMatchObject({ used: 0 });
    }
    expect(touch).not.toHaveBeenCalled();
  });

  it('the conflict is by presence: an empty cookie, an unknown token, another scheme', async () => {
    const presented: Array<Record<string, string>> = [
      { cookie: `${OWN_COOKIE}=`, authorization: `Bearer ${DEVICE_TOKEN}` },
      { ...cookie(UNKNOWN_TOKEN), authorization: 'Basic dXNlcjpwYXNz' },
      { ...cookie('x'), authorization: '' },
    ];
    for (const headers of presented) {
      const response = await read(headers);
      expect(response.statusCode).toBe(401);
      expect(ApiErrorSchema.parse(response.json()).error.details).toEqual({ reason: CREDENTIAL_CONFLICT_REASON });
    }
    expect(resolve).not.toHaveBeenCalled();
  });

  it('it comes before the throttle (spec §7.3 line 4 before line 5) and before the body is read', async () => {
    for (let count = 0; count < 31; count += 1) await read();
    expect((await read()).statusCode).toBe(429);
    expect((await read(both)).statusCode).toBe(401);
    throttleControl(app).reset();
    const malformed = await app.inject({
      method: 'POST',
      url: '/api/v1/scratch',
      headers: { ...both, origin: WEB_ORIGIN, 'content-type': 'application/json' },
      payload: '{"broken": ',
    });
    expect(malformed.statusCode).toBe(401);
  });

  it('one log line names the reason, beside the request line; neither holds a credential', async () => {
    const before = log.lines().length;
    await read(both);
    const lines = log.lines().slice(before);
    expect(lines.find((line) => line['msg'] === 'request refused: two credentials')).toMatchObject({
      level: 40,
      code: 'NOT_SIGNED_IN',
      reason: 'CREDENTIAL_CONFLICT',
      route: '/api/v1/scratch',
    });
    expect(lines.find((line) => line['msg'] === 'request completed')).toMatchObject({ status: 401, code: 'NOT_SIGNED_IN', principal: null });
  });
});

describe('D69: only this instance\'s cookie name is a credential', () => {
  it('a bearer request that carries another instance\'s cookie and an unrelated cookie resolves as the bearer session', async () => {
    const response = await read({ ...bearer(DEVICE_TOKEN), origin: OWN_ORIGIN, cookie: `dems_session_4421=${WEB_TOKEN}; theme=dark; session=${WEB_TOKEN}` });
    expect(response.statusCode).toBe(200);
    expect(seenBy(response).principal).toEqual(DEVICE_OPERATOR);
    expect(resolve.mock.calls).toEqual([[DEVICE_TOKEN, 'BEARER']]);
  });

  it('a bearer request that carries this instance\'s own cookie is the 401', async () => {
    const response = await read({ ...bearer(DEVICE_TOKEN), cookie: `dems_session_4421=${WEB_TOKEN}; ${OWN_COOKIE}=${WEB_TOKEN}` });
    expect(response.statusCode).toBe(401);
    expect(ApiErrorSchema.parse(response.json()).error.details).toEqual({ reason: CREDENTIAL_CONFLICT_REASON });
  });

  it('another instance\'s cookie alone is no credential: ANONYMOUS, nothing looked up', async () => {
    const response = await read(cookie(WEB_TOKEN, 'dems_session_4421'));
    expect(seenBy(response)).toEqual({ principal: ANONYMOUS, authentication: { presented: 'NONE', failure: null, session: null }, throttleKey: 'class:local' });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('this instance\'s cookie among other cookies is found, wherever it stands', async () => {
    const response = await read({ cookie: `theme=dark; dems_session_4421=${UNKNOWN_TOKEN}; ${OWN_COOKIE}=${WEB_TOKEN}; other=1` });
    expect(seenBy(response).principal).toEqual(WEB_OPERATOR);
  });

  it('neither Host nor User-Agent nor the presence of an Origin changes what a bearer resolves to', async () => {
    const variants: Array<Record<string, string>> = [
      {},
      { host: '127.0.0.1:4420' },
      { host: '127.0.0.1:4421', 'user-agent': 'okhttp/4.12.0' },
      { host: 'evil.example', 'user-agent': 'curl/8' },
      { origin: OWN_ORIGIN },
    ];
    for (const headers of variants) {
      expect(seenBy(await read({ ...bearer(DEVICE_TOKEN), ...headers })).principal).toEqual(DEVICE_OPERATOR);
    }
  });
});

describe('SR-75: the principal is resolved before the throttle', () => {
  it('a resolved operator is counted under operator:<id>, a device under device:<id>, everything else in its class', async () => {
    expect(seenBy(await read(cookie(WEB_TOKEN))).throttleKey).toBe('operator:OPR-002');
    expect(seenBy(await read(bearer(DEVICE_TOKEN))).throttleKey).toBe('operator:OPR-002');
    expect(seenBy(await read(bearer(PAIRED_CREDENTIAL))).throttleKey).toBe('device:DEV-0003');
    expect(seenBy(await app.inject({ method: 'GET', url: '/api/v1/scratch', headers: { ...cookie(UNKNOWN_TOKEN), origin: WEB_ORIGIN } })).throttleKey).toBe('class:web');
  });

  it('31 requests with 31 different unknown bearer values share one bucket; an operator\'s 31st request is not refused', async () => {
    const answers: number[] = [];
    for (let count = 0; count < 31; count += 1) {
      answers.push((await read(bearer(`ses_${String(count).padStart(43, 'a')}`))).statusCode);
    }
    expect(answers.slice(0, 30).every((status) => status === 200)).toBe(true);
    expect(answers[30]).toBe(429);
    const operator: number[] = [];
    for (let count = 0; count < 31; count += 1) operator.push((await read(cookie(WEB_TOKEN))).statusCode);
    expect(new Set(operator)).toEqual(new Set([200]));
  });
});

describe('activity (ID-P9): a POST of an operator that reaches its handler', () => {
  const post = (headers: Record<string, string>, url = '/api/v1/scratch'): Promise<LightMyRequestResponse> =>
    app.inject({ method: 'POST', url, headers: { origin: WEB_ORIGIN, ...headers }, payload: {} });

  it('records activity on the session, and the handler sees the new last activity', async () => {
    clock.advance(60_000);
    const response = await post(cookie(WEB_TOKEN));
    expect(response.statusCode).toBe(200);
    expect(touch.mock.calls).toEqual([[WEB_SESSION.id]]);
    expect(seenBy(response).authentication.session?.lastSeenAt).toBe(clock.now());
  });

  it('a GET never does; neither does a POST without an operator, nor one within a second of the last activity', async () => {
    clock.advance(60_000);
    await read(cookie(WEB_TOKEN));
    await app.inject({ method: 'POST', url: '/api/v1/scratch', headers: bearer(PAIRED_CREDENTIAL), payload: {} });
    await post({});
    expect(touch).not.toHaveBeenCalled();

    const recent = { ...WEB_SESSION, lastSeenAt: clock.now() - 999 };
    resolve.mockResolvedValueOnce({ status: 'OPEN', session: recent });
    expect((await post(cookie(WEB_TOKEN))).statusCode).toBe(200);
    expect(touch).not.toHaveBeenCalled();
    resolve.mockResolvedValueOnce({ status: 'OPEN', session: { ...recent, lastSeenAt: clock.now() - 1_000 } });
    await post(cookie(WEB_TOKEN));
    expect(touch).toHaveBeenCalledTimes(1);
  });

  it('a password sign-in and a sign-out settle their session themselves', async () => {
    expect(ACTIVITY_EXEMPT_OPERATIONS).toEqual(['signIn', 'signOut']);
    clock.advance(60_000);
    expect((await post(cookie(WEB_TOKEN), '/api/v1/scratch/sign-out')).statusCode).toBe(200);
    expect(handled.signOut).toBe(1);
    expect(touch).not.toHaveBeenCalled();
  });

  it('a biometric sign-in reaches its handler as a DEVICE principal with no session, so the activity hook touches nothing (D126 G-1: the exempt list no longer needs it)', async () => {
    clock.advance(60_000);
    // Operation 8 carries the condition DEVICE_CREDENTIAL: only a device credential reaches it, and a
    // device credential resolves to a DEVICE principal that presents no operator session. The hook
    // returns at the session check, so it touches nothing whether or not the operation is exempt.
    const response = await app.inject({ method: 'POST', url: '/api/v1/scratch/biometric-sign-in', headers: bearer(PAIRED_CREDENTIAL), payload: {} });
    expect(response.statusCode).toBe(200);
    expect(seenBy(response).principal).toMatchObject({ kind: 'DEVICE', deviceId: 'DEV-0003' });
    expect(seenBy(response).authentication.session).toBeNull();
    expect(biometricSignIns).toBe(1);
    expect(touch).not.toHaveBeenCalled();
  });

  it('a session that ended between stage 4 and the handler is refused with 401, and the command does not run', async () => {
    clock.advance(60_000);
    touch.mockResolvedValueOnce({ status: 'ENDED' });
    const response = await post(cookie(WEB_TOKEN));
    expect(response.statusCode).toBe(401);
    expect(ApiErrorSchema.parse(response.json()).error).toMatchObject({ code: 'NOT_SIGNED_IN', message: 'Sign in first.' });
    expect(handled.post).toBe(0);
  });

  it('an unchanged session keeps the stored last activity', async () => {
    clock.advance(60_000);
    touch.mockResolvedValueOnce({ status: 'UNCHANGED', lastSeenAt: 123 });
    expect(seenBy(await post(cookie(WEB_TOKEN))).authentication.session?.lastSeenAt).toBe(123);
  });
});

describe('what a handler and the realtime channel read', () => {
  it('operatorSessionOf gives the session of an OPERATOR and refuses everybody else with 401', async () => {
    const operator = await app.inject({ method: 'GET', url: '/api/v1/scratch/operator', headers: cookie(WEB_TOKEN) });
    expect(operator.json()).toEqual({ sessionId: WEB_SESSION.id });
    for (const headers of [{}, bearer(PAIRED_CREDENTIAL), cookie(ENDED_TOKEN), bearer(RETIRED_CREDENTIAL)]) {
      const refused = await app.inject({ method: 'GET', url: '/api/v1/scratch/operator', headers });
      expect(refused.statusCode).toBe(401);
      expect(ApiErrorSchema.parse(refused.json()).error.code).toBe('NOT_SIGNED_IN');
    }
  });

  it('a request with an Upgrade header is resolved like any request: the principal and why a credential did not resolve', async () => {
    const upgrade = { connection: 'Upgrade', upgrade: 'websocket' };
    expect(seenBy(await read({ ...upgrade, ...cookie(WEB_TOKEN), origin: WEB_ORIGIN })).principal).toEqual(WEB_OPERATOR);
    expect(seenBy(await read({ ...upgrade, ...cookie(ENDED_TOKEN), origin: WEB_ORIGIN })).authentication).toEqual({ presented: 'COOKIE', failure: 'ENDED', session: null });
    expect(seenBy(await read({ ...upgrade, ...bearer(DEVICE_TOKEN), origin: OWN_ORIGIN })).principal).toEqual(DEVICE_OPERATOR);
    expect(seenBy(await read({ ...upgrade, ...bearer(RETIRED_CREDENTIAL) })).authentication.failure).toBe('DEVICE_RETIRED');
    const conflict = await read({ ...upgrade, ...cookie(WEB_TOKEN), ...bearer(DEVICE_TOKEN), origin: WEB_ORIGIN });
    expect(conflict.statusCode).toBe(401);
  });

  it('the anonymous principal of the scaffold is unchanged', () => {
    expect(ANONYMOUS_PRINCIPAL).toEqual({ kind: 'ANONYMOUS', retiredDeviceId: null });
    expect(Object.isFrozen(ANONYMOUS_PRINCIPAL)).toBe(true);
  });
});

describe('the log of stage 4 (SR-15, SR-48)', () => {
  it('at level trace, no line holds a token, a credential or a cookie value; the request line names the principal by its ID', async () => {
    const before = log.text().length;
    await read(cookie(WEB_TOKEN));
    await read(bearer(DEVICE_TOKEN));
    await read(bearer(PAIRED_CREDENTIAL));
    await read(bearer(UNKNOWN_TOKEN));
    await read({ ...cookie(WEB_TOKEN), ...bearer(DEVICE_TOKEN) });
    await app.inject({ method: 'GET', url: `/api/v1/scratch?token=${WEB_TOKEN}`, headers: cookie(WEB_TOKEN) });
    const text = log.text().slice(before);
    expect(credentialLeaks(text)).toEqual([]);
    for (const value of [WEB_TOKEN, DEVICE_TOKEN, PAIRED_CREDENTIAL, UNKNOWN_TOKEN]) expect(text.includes(value)).toBe(false);
    expect(text.includes('token=')).toBe(false);
    const principals = log
      .lines()
      .filter((line) => line['msg'] === 'request completed')
      .slice(-6)
      .map((line) => line['principal']);
    expect(principals).toEqual(['operator:OPR-002', 'operator:OPR-002', 'device:DEV-0003', null, null, 'operator:OPR-002']);
  });
});
