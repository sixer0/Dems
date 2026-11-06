// Stage 3 of the request pipeline in the real app factory (plan row W23; HB-6; spec §2.3,
// §14.2; SR-04, SR-19, SR-20, SR-21, SR-69, SR-70; AC-B-43 and AC-B-74 in unit form, REST).
// In-process: `app.inject`, no listener, no database.
//
// Every cell of the HTTP decision table is one request. The cells that the table answers with
// 401 are refused by stage 4, which is plan row W24's; here a stand-in does what ID-12 says, and
// a second run with the scaffold's stub shows that stage 3 itself lets those requests through.
import { ApiErrorCode, CREDENTIAL_CONFLICT_REASON } from '@dems/shared/api';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { BODY_LIMIT_BYTES } from '../../../config';
import { captureLog, unitTestConfig } from '../../../../test/support/config';
import { OriginCategory, UNLOGGABLE_ORIGIN, type OriginFacts } from '../index';
import {
  FOREIGN_ORIGIN,
  OWN_ORIGIN,
  SCRATCH_COMMAND,
  SCRATCH_PATTERN,
  SCRATCH_READ,
  SESSION_COOKIE,
  WEB_CONSOLE_ORIGIN,
  authenticateBySpecification,
  buildGuardApp,
  errorOf,
  expectNoCorsHeader,
  expectRefusal,
  expectResponseHeaders,
  type GuardApp,
} from './guard-test-app';

const ORIGIN_NOT_ALLOWED = ApiErrorCode.ORIGIN_NOT_ALLOWED;

type Row = 'cookie' | 'bearer' | 'none' | 'cookie and bearer';
type Column = 'no Origin' | 'own origin' | 'web console origin' | 'other origin' | 'null';

const CREDENTIAL_HEADERS: Readonly<Record<Row, Record<string, string>>> = {
  cookie: { cookie: `${SESSION_COOKIE}=ses_value-of-a-test` },
  bearer: { authorization: 'Bearer dvc_value-of-a-test' },
  none: {},
  'cookie and bearer': { cookie: `${SESSION_COOKIE}=ses_value-of-a-test`, authorization: 'Bearer dvc_value-of-a-test' },
};

const ORIGIN_HEADERS: Readonly<Record<Column, Record<string, string>>> = {
  'no Origin': {},
  'own origin': { origin: OWN_ORIGIN },
  'web console origin': { origin: WEB_CONSOLE_ORIGIN },
  'other origin': { origin: FOREIGN_ORIGIN },
  null: { origin: 'null' },
};

/** What the caller gets: the handler's 200, 403 of stage 3, or 401 of stage 4. */
type Answer = 200 | 401 | 403;

/** `[row, column, method, answer]`: the decision table for HTTP requests of spec §14.2. */
const HTTP_TABLE: ReadonlyArray<readonly [Row, Column, 'GET' | 'POST', Answer]> = [
  ['cookie', 'no Origin', 'GET', 200],
  ['cookie', 'no Origin', 'POST', 403],
  ['cookie', 'own origin', 'GET', 403],
  ['cookie', 'own origin', 'POST', 403],
  ['cookie', 'web console origin', 'GET', 200],
  ['cookie', 'web console origin', 'POST', 200],
  ['cookie', 'other origin', 'GET', 403],
  ['cookie', 'other origin', 'POST', 403],
  ['cookie', 'null', 'GET', 403],
  ['cookie', 'null', 'POST', 403],

  ['bearer', 'no Origin', 'GET', 200],
  ['bearer', 'no Origin', 'POST', 200],
  ['bearer', 'own origin', 'GET', 200],
  ['bearer', 'own origin', 'POST', 200],
  ['bearer', 'web console origin', 'GET', 403],
  ['bearer', 'web console origin', 'POST', 403],
  ['bearer', 'other origin', 'GET', 403],
  ['bearer', 'other origin', 'POST', 403],
  ['bearer', 'null', 'GET', 403],
  ['bearer', 'null', 'POST', 403],

  ['none', 'no Origin', 'GET', 200],
  ['none', 'no Origin', 'POST', 200],
  ['none', 'own origin', 'GET', 200],
  ['none', 'own origin', 'POST', 200],
  ['none', 'web console origin', 'GET', 200],
  ['none', 'web console origin', 'POST', 200],
  ['none', 'other origin', 'GET', 403],
  ['none', 'other origin', 'POST', 403],
  ['none', 'null', 'GET', 403],
  ['none', 'null', 'POST', 403],

  ['cookie and bearer', 'no Origin', 'GET', 401],
  ['cookie and bearer', 'no Origin', 'POST', 403],
  ['cookie and bearer', 'own origin', 'GET', 403],
  ['cookie and bearer', 'own origin', 'POST', 403],
  ['cookie and bearer', 'web console origin', 'GET', 401],
  ['cookie and bearer', 'web console origin', 'POST', 401],
  ['cookie and bearer', 'other origin', 'GET', 403],
  ['cookie and bearer', 'other origin', 'POST', 403],
  ['cookie and bearer', 'null', 'GET', 403],
  ['cookie and bearer', 'null', 'POST', 403],
];

/** The decision table for the upgrade of spec §14.2, as stage 3 answers a request with `Upgrade`. */
const UPGRADE_TABLE: ReadonlyArray<readonly [Row, Column, Answer]> = [
  ['cookie', 'no Origin', 403],
  ['cookie', 'own origin', 403],
  ['cookie', 'web console origin', 200],
  ['cookie', 'other origin', 403],
  ['cookie', 'null', 403],
  ['bearer', 'no Origin', 200],
  ['bearer', 'own origin', 200],
  ['bearer', 'web console origin', 403],
  ['bearer', 'other origin', 403],
  ['bearer', 'null', 403],
  ['none', 'no Origin', 200],
  ['none', 'own origin', 200],
  ['none', 'web console origin', 200],
  ['none', 'other origin', 403],
  ['none', 'null', 403],
  ['cookie and bearer', 'no Origin', 403],
  ['cookie and bearer', 'own origin', 403],
  ['cookie and bearer', 'web console origin', 401],
  ['cookie and bearer', 'other origin', 403],
  ['cookie and bearer', 'null', 403],
];

const UPGRADE_HEADERS = { connection: 'Upgrade', upgrade: 'websocket' };

/** The five values of AC-B-74. */
const AC_B_74: ReadonlyArray<readonly [string, string]> = [
  ['a localhost origin', 'http://localhost:5173'],
  ['the literal null', 'null'],
  ['a trailing slash', 'http://127.0.0.1:5173/'],
  ['an upper-case scheme', 'HTTP://127.0.0.1:5173'],
  ['port 5174', 'http://127.0.0.1:5174'],
];

function request(method: 'GET' | 'POST', row: Row, column: Column, more: Record<string, string> = {}): InjectOptions {
  return {
    method,
    url: method === 'GET' ? SCRATCH_READ : SCRATCH_COMMAND,
    headers: { ...CREDENTIAL_HEADERS[row], ...ORIGIN_HEADERS[column], ...more },
    ...(method === 'POST' ? { payload: { note: 'x' } } : {}),
  };
}

describe('stage 3 with stage 4 as the specification defines it', () => {
  let guard: GuardApp;
  let app: FastifyInstance;

  beforeAll(async () => {
    guard = await buildGuardApp();
    app = guard.app;
    authenticateBySpecification(app);
    // Stage 5 is not the subject here: the table has more cells than a class bucket has places.
    app.stages.replace('throttle', () => {});
  });

  afterAll(() => app.close());

  describe('the decision table for HTTP requests (spec §14.2; AC-B-43, AC-B-73 in unit form)', () => {
    it('has every cell: four credential rows, four Origin columns with null beside "any other", GET and POST', () => {
      expect(HTTP_TABLE).toHaveLength(4 * 5 * 2);
      expect(new Set(HTTP_TABLE.map(([row, column, method]) => `${row}|${column}|${method}`)).size).toBe(40);
    });

    it.each(HTTP_TABLE)('%s, %s, %s answers %i', async (row, column, method, answer) => {
      const before = { ...guard.handled };
      const response = await app.inject(request(method, row, column));

      if (answer === 200) {
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ ok: true });
        expectResponseHeaders(response);
      } else if (answer === 403) {
        expectRefusal(response, 403, ORIGIN_NOT_ALLOWED);
        expect(errorOf(response).details).toBeUndefined();
      } else {
        expectRefusal(response, 401, ApiErrorCode.NOT_SIGNED_IN);
        expect(errorOf(response).details).toEqual({ reason: CREDENTIAL_CONFLICT_REASON });
      }
      // A refusal never reaches the handler.
      const ran = guard.handled.read + guard.handled.command - before.read - before.command;
      expect(ran).toBe(answer === 200 ? 1 : 0);
    });
  });

  describe('the named cases of AC-B-43', () => {
    it('a POST with a foreign Origin answers 403', async () => {
      for (const row of ['cookie', 'bearer', 'none', 'cookie and bearer'] as const) {
        expectRefusal(await app.inject(request('POST', row, 'other origin')), 403, ORIGIN_NOT_ALLOWED);
      }
    });

    it('a POST with the cookie and no Origin answers 403', async () => {
      expectRefusal(await app.inject(request('POST', 'cookie', 'no Origin')), 403, ORIGIN_NOT_ALLOWED);
    });

    it('a POST with the cookie and one of the instance\'s own origins answers 403', async () => {
      expectRefusal(await app.inject(request('POST', 'cookie', 'own origin')), 403, ORIGIN_NOT_ALLOWED);
    });
  });

  describe('AC-B-74: exact match, no localhost, null refused', () => {
    it.each(AC_B_74)('%s answers 403 ORIGIN_NOT_ALLOWED on a POST, with and without a credential', async (_label, origin) => {
      for (const row of ['none', 'cookie', 'bearer', 'cookie and bearer'] as const) {
        const response = await app.inject({
          method: 'POST',
          url: SCRATCH_COMMAND,
          headers: { ...CREDENTIAL_HEADERS[row], origin },
          payload: { note: 'x' },
        });
        expectRefusal(response, 403, ORIGIN_NOT_ALLOWED);
      }
    });

    it.each(AC_B_74)('%s answers 403 on a GET and on a request with an Upgrade header as well', async (_label, origin) => {
      expectRefusal(await app.inject({ method: 'GET', url: SCRATCH_READ, headers: { origin } }), 403, ORIGIN_NOT_ALLOWED);
      const upgrade = await app.inject({ method: 'GET', url: SCRATCH_READ, headers: { origin, ...UPGRADE_HEADERS } });
      expectRefusal(upgrade, 403, ORIGIN_NOT_ALLOWED);
    });

    it.each([
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5176',
      'http://127.0.0.1:5177',
      'http://127.0.0.1:5178',
    ])('the web console origin %s is accepted on a POST with the cookie', async (origin) => {
      const response = await app.inject({
        method: 'POST',
        url: SCRATCH_COMMAND,
        headers: { ...CREDENTIAL_HEADERS.cookie, origin },
        payload: {},
      });
      expect(response.statusCode).toBe(200);
    });

    it.each([
      ['https instead of http', 'https://127.0.0.1:5173'],
      ['a trailing space', 'http://127.0.0.1:5173 '],
      ['a listed origin as a prefix', 'http://127.0.0.1:51730'],
      ['a user part that names a listed origin', 'http://127.0.0.1:5173@evil.example'],
      ['an empty value', ''],
      ['a lane instance\'s own port on the main instance', 'http://127.0.0.1:4421'],
    ])('%s answers 403 on a POST without a credential', async (_label, origin) => {
      const response = await app.inject({ method: 'POST', url: SCRATCH_COMMAND, headers: { origin }, payload: {} });
      expectRefusal(response, 403, ORIGIN_NOT_ALLOWED);
    });
  });

  describe('a request with an Upgrade header is held to the upgrade table (spec §14.2, §9.2)', () => {
    it('has every cell: four credential rows, four Origin columns with null beside "any other"', () => {
      expect(UPGRADE_TABLE).toHaveLength(4 * 5);
    });

    it.each(UPGRADE_TABLE)('%s, %s answers %i', async (row, column, answer) => {
      const response = await app.inject(request('GET', row, column, UPGRADE_HEADERS));
      expect(response.statusCode).toBe(answer);
      if (answer === 403) expectRefusal(response, 403, ORIGIN_NOT_ALLOWED);
      if (answer === 401) expect(errorOf(response).details).toEqual({ reason: CREDENTIAL_CONFLICT_REASON });
      expectNoCorsHeader(response);
    });

    it('the one difference to a plain GET: the cookie without an Origin', async () => {
      expect((await app.inject(request('GET', 'cookie', 'no Origin'))).statusCode).toBe(200);
      expect((await app.inject(request('GET', 'cookie', 'no Origin', UPGRADE_HEADERS))).statusCode).toBe(403);
    });
  });

  describe('what a refusal looks like', () => {
    it('has a fixed text and repeats no part of the request', async () => {
      const marker = 'http://marker-7f3a91.example';
      const response = await app.inject({
        method: 'POST',
        url: `${SCRATCH_COMMAND}?probe=marker-query-51c0`,
        headers: { origin: marker, cookie: `${SESSION_COOKIE}=marker-cookie-88e2`, authorization: 'Bearer marker-bearer-03bd' },
        payload: { note: 'marker-body-6a41' },
      });
      expectRefusal(response, 403, ORIGIN_NOT_ALLOWED);
      expect(errorOf(response).message).toBe('This origin may not call the Core server.');
      const everything = `${JSON.stringify(response.headers)}\n${response.body}`;
      for (const part of ['marker-7f3a91', 'marker-query-51c0', 'marker-cookie-88e2', 'marker-bearer-03bd', 'marker-body-6a41']) {
        expect(everything, part).not.toContain(part);
      }
    });

    it('carries no CORS header, and neither does an accepted answer for a listed origin (SR-04, OR-5)', async () => {
      const answers = await Promise.all([
        app.inject(request('POST', 'none', 'other origin')),
        app.inject(request('POST', 'none', 'null')),
        app.inject(request('POST', 'cookie', 'web console origin')),
        app.inject(request('GET', 'bearer', 'own origin')),
        app.inject({ method: 'GET', url: '/api/v1/health', headers: { origin: WEB_CONSOLE_ORIGIN } }),
      ]);
      expect(answers.map((answer) => answer.statusCode)).toEqual([403, 403, 200, 200, 200]);
      for (const answer of answers) {
        expectNoCorsHeader(answer);
        expect(answer.headers.vary).toBeUndefined();
        // No header value repeats an origin.
        expect(JSON.stringify(answer.headers)).not.toContain('127.0.0.1');
      }
    });

    it('is decided before the body is read: it wins over malformed JSON and over a body above the limit', async () => {
      const json = { 'content-type': 'application/json', origin: FOREIGN_ORIGIN };
      const malformed = await app.inject({ method: 'POST', url: SCRATCH_COMMAND, headers: json, payload: '{"note": ' });
      expectRefusal(malformed, 403, ORIGIN_NOT_ALLOWED);
      const tooLarge = await app.inject({
        method: 'POST',
        url: SCRATCH_COMMAND,
        headers: json,
        payload: JSON.stringify({ note: 'x'.repeat(BODY_LIMIT_BYTES) }),
      });
      expectRefusal(tooLarge, 403, ORIGIN_NOT_ALLOWED);
      // The same two bodies from an accepted caller reach stage 7 (AC-B-14: 413).
      const accepted = { 'content-type': 'application/json', origin: WEB_CONSOLE_ORIGIN };
      const parsed = await app.inject({ method: 'POST', url: SCRATCH_COMMAND, headers: accepted, payload: '{"note": ' });
      expectRefusal(parsed, 400, ApiErrorCode.INVALID_JSON);
      const limited = await app.inject({
        method: 'POST',
        url: SCRATCH_COMMAND,
        headers: accepted,
        payload: JSON.stringify({ note: 'x'.repeat(BODY_LIMIT_BYTES) }),
      });
      expectRefusal(limited, 413, ApiErrorCode.PAYLOAD_TOO_LARGE);
    });
  });

  describe('the health operation follows the table too', () => {
    it('answers a caller without an Origin and refuses a foreign one', async () => {
      expect((await app.inject({ method: 'GET', url: '/api/v1/health' })).statusCode).toBe(200);
      const foreign = await app.inject({ method: 'GET', url: '/api/v1/health', headers: { origin: FOREIGN_ORIGIN } });
      expectRefusal(foreign, 403, ORIGIN_NOT_ALLOWED);
    });
  });
});

describe('stage 3 alone, with the scaffold\'s stub at stage 4', () => {
  let guard: GuardApp;
  let app: FastifyInstance;

  beforeAll(async () => {
    guard = await buildGuardApp();
    app = guard.app;
    app.stages.replace('throttle', () => {});
    app.stages.replace('authenticate', () => {});
  });

  afterAll(() => app.close());

  it.each(HTTP_TABLE)('%s, %s, %s: stage 3 refuses exactly the 403 cells (expected answer %i)', async (row, column, method, answer) => {
    const response = await app.inject(request(method, row, column));
    // What stage 4 would refuse with 401 has passed stage 3.
    expect(response.statusCode).toBe(answer === 403 ? 403 : 200);
  });
});

describe('error precedence around stage 3 (spec §7.3)', () => {
  const apps: FastifyInstance[] = [];
  afterEach(async () => {
    for (const app of apps.splice(0)) await app.close();
  });

  it('line 1 before line 3: an unknown path and another method are answered whatever the Origin', async () => {
    const { app } = await buildGuardApp();
    apps.push(app);
    for (const origin of [FOREIGN_ORIGIN, 'null', WEB_CONSOLE_ORIGIN]) {
      const unknown = await app.inject({ method: 'POST', url: '/api/v1/nope', headers: { origin }, payload: {} });
      expectRefusal(unknown, 404, ApiErrorCode.NOT_FOUND);
      const otherMethod = await app.inject({ method: 'DELETE', url: SCRATCH_COMMAND, headers: { origin } });
      expectRefusal(otherMethod, 405, ApiErrorCode.METHOD_NOT_ALLOWED);
      expect(otherMethod.headers.allow).toBe('GET, POST');
    }
  });

  it('line 2 before line 3: while the server is not ready a foreign Origin answers 503, health excepted', async () => {
    const { app } = await buildGuardApp({ notReady: true });
    apps.push(app);
    const refused = await app.inject({ method: 'POST', url: SCRATCH_COMMAND, headers: { origin: FOREIGN_ORIGIN }, payload: {} });
    expectRefusal(refused, 503, ApiErrorCode.NOT_READY);
    // Health passes stage 2 and is then held to the table.
    const health = await app.inject({ method: 'GET', url: '/api/v1/health', headers: { origin: FOREIGN_ORIGIN } });
    expectRefusal(health, 403, ORIGIN_NOT_ALLOWED);
  });

  it('line 3 before lines 4 to 7: a refusal stops stages 4, 5 and 6', async () => {
    const { app } = await buildGuardApp();
    apps.push(app);
    const ran: string[] = [];
    for (const stage of ['authenticate', 'throttle', 'accessRule'] as const) {
      app.stages.replace(stage, () => void ran.push(stage));
    }
    expectRefusal(await app.inject(request('POST', 'none', 'other origin')), 403, ORIGIN_NOT_ALLOWED);
    expect(ran).toEqual([]);
    expect((await app.inject(request('POST', 'none', 'web console origin'))).statusCode).toBe(200);
    expect(ran).toEqual(['authenticate', 'throttle', 'accessRule']);
  });
});

describe('a CORS preflight (decision D34: it now reaches the Core server)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = (await buildGuardApp()).app;
  });

  afterAll(() => app.close());

  const preflight = (url: string, origin: string): InjectOptions => ({
    method: 'OPTIONS',
    url,
    headers: {
      origin,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type, authorization',
    },
  });

  it.each([WEB_CONSOLE_ORIGIN, OWN_ORIGIN, FOREIGN_ORIGIN, 'http://localhost:5176', 'null'])(
    'from %s is answered 405 METHOD_NOT_ALLOWED with allow, by routing, with no CORS header',
    async (origin) => {
      const response = await app.inject(preflight(SCRATCH_COMMAND, origin));
      expectRefusal(response, 405, ApiErrorCode.METHOD_NOT_ALLOWED);
      expect(response.headers.allow).toBe('GET, POST');
      expectNoCorsHeader(response);
    },
  );

  it('for a path that does not exist is answered 404, with no CORS header', async () => {
    const response = await app.inject(preflight('/api/v1/nope', WEB_CONSOLE_ORIGIN));
    expectRefusal(response, 404, ApiErrorCode.NOT_FOUND);
    expectNoCorsHeader(response);
  });

  it('gives the same answer for a listed and for a foreign origin: it tells nothing about the lists', async () => {
    const listed = await app.inject(preflight('/api/v1/health', WEB_CONSOLE_ORIGIN));
    const foreign = await app.inject(preflight('/api/v1/health', FOREIGN_ORIGIN));
    expect(listed.statusCode).toBe(405);
    expect(foreign.statusCode).toBe(405);
    expect(errorOf(listed).message).toBe(errorOf(foreign).message);
    expect(listed.headers.allow).toBe(foreign.headers.allow);
  });
});

describe('the seam originDecision', () => {
  const apps: FastifyInstance[] = [];
  afterEach(async () => {
    for (const app of apps.splice(0)) await app.close();
  });

  /** The facts the seam reports for one request, read inside the handler. */
  async function factsFor(app: FastifyInstance, seen: OriginFacts[], headers: Record<string, string>): Promise<OriginFacts | undefined> {
    seen.length = 0;
    await app.inject({ method: 'GET', url: '/api/v1/facts', headers });
    return seen[0];
  }

  async function factsApp(config = unitTestConfig()): Promise<{ app: FastifyInstance; seen: OriginFacts[] }> {
    const seen: OriginFacts[] = [];
    const { app } = await buildGuardApp({
      config,
      routes: (instance) => {
        instance.get('/api/v1/facts', async (incoming) => {
          // Asked twice: the same answer for the same request.
          seen.push(instance.originDecision(incoming), instance.originDecision(incoming));
          return {};
        });
      },
    });
    apps.push(app);
    // The facts of every request, also of one stage 3 would refuse.
    app.stages.replace('originGuard', () => {});
    app.stages.replace('throttle', () => {});
    app.stages.replace('authenticate', () => {});
    return { app, seen };
  }

  it('reports the category and the presence of each credential, the same however often it is asked', async () => {
    const { app, seen } = await factsApp();
    const cases: ReadonlyArray<readonly [Record<string, string>, OriginFacts]> = [
      [{}, { category: OriginCategory.ABSENT, hasCookie: false, hasBearer: false }],
      [{ origin: WEB_CONSOLE_ORIGIN }, { category: OriginCategory.WEB_CONSOLE, hasCookie: false, hasBearer: false }],
      [{ origin: OWN_ORIGIN }, { category: OriginCategory.OWN, hasCookie: false, hasBearer: false }],
      [{ origin: FOREIGN_ORIGIN }, { category: OriginCategory.OTHER, hasCookie: false, hasBearer: false }],
      [{ origin: 'null' }, { category: OriginCategory.OTHER, hasCookie: false, hasBearer: false }],
      [{ origin: 'http://localhost:5173' }, { category: OriginCategory.OTHER, hasCookie: false, hasBearer: false }],
      [
        { origin: WEB_CONSOLE_ORIGIN, cookie: `${SESSION_COOKIE}=x` },
        { category: OriginCategory.WEB_CONSOLE, hasCookie: true, hasBearer: false },
      ],
      [{ authorization: 'Bearer dvc_x' }, { category: OriginCategory.ABSENT, hasCookie: false, hasBearer: true }],
      [
        { origin: OWN_ORIGIN, authorization: 'Bearer ses_x', cookie: `${SESSION_COOKIE}=x` },
        { category: OriginCategory.OWN, hasCookie: true, hasBearer: true },
      ],
    ];
    for (const [headers, expected] of cases) {
      expect(await factsFor(app, seen, headers), JSON.stringify(headers)).toEqual(expected);
      expect(seen[1]).toEqual(expected);
    }
  });

  it('SR-69: an own origin is reported as OWN, so it can never satisfy the console rule ID-1 (a)', async () => {
    const { app, seen } = await factsApp();
    const own = await factsFor(app, seen, { origin: OWN_ORIGIN });
    expect(own?.category).toBe(OriginCategory.OWN);
    expect(own?.category).not.toBe(OriginCategory.WEB_CONSOLE);
  });

  it('presence only: an empty cookie value, an empty or non-bearer Authorization header still count', async () => {
    const { app, seen } = await factsApp();
    expect((await factsFor(app, seen, { cookie: `${SESSION_COOKIE}=` }))?.hasCookie).toBe(true);
    expect((await factsFor(app, seen, { authorization: '' }))?.hasBearer).toBe(true);
    expect((await factsFor(app, seen, { authorization: 'Basic dXNlcjpwYXNz' }))?.hasBearer).toBe(true);
  });

  it('another cookie is not this instance\'s cookie: a lane\'s, a prefix, another case', async () => {
    const { app, seen } = await factsApp();
    for (const cookie of ['dems_session_4421=x', 'dems_session=x', 'DEMS_SESSION_4420=x', 'other=1; dems_session_44200=x']) {
      expect((await factsFor(app, seen, { cookie }))?.hasCookie, cookie).toBe(false);
    }
    expect((await factsFor(app, seen, { cookie: `other=1; ${SESSION_COOKIE}=x` }))?.hasCookie).toBe(true);
  });

  it('a lane instance: its own port is OWN as well, and its cookie has its own name', async () => {
    const { app, seen } = await factsApp(unitTestConfig({ port: 4422 }));
    expect((await factsFor(app, seen, { origin: 'http://127.0.0.1:4422' }))?.category).toBe(OriginCategory.OWN);
    expect((await factsFor(app, seen, { origin: OWN_ORIGIN }))?.category).toBe(OriginCategory.OWN);
    expect((await factsFor(app, seen, { origin: 'http://127.0.0.1:4421' }))?.category).toBe(OriginCategory.OTHER);
    expect((await factsFor(app, seen, { cookie: 'dems_session_4422=x' }))?.hasCookie).toBe(true);
    expect((await factsFor(app, seen, { cookie: `${SESSION_COOKIE}=x` }))?.hasCookie).toBe(false);
  });

  it('on a lane instance the main instance\'s cookie is no credential; the lane\'s own cookie is', async () => {
    const { app } = await buildGuardApp({ config: unitTestConfig({ port: 4422 }) });
    apps.push(app);
    // The main instance's cookie is no credential here: the request is the row "none".
    const foreignCookie = await app.inject({ method: 'POST', url: SCRATCH_COMMAND, headers: { cookie: `${SESSION_COOKIE}=x` }, payload: {} });
    expect(foreignCookie.statusCode).toBe(200);
    const ownCookie = await app.inject({ method: 'POST', url: SCRATCH_COMMAND, headers: { cookie: 'dems_session_4422=x' }, payload: {} });
    expectRefusal(ownCookie, 403, ORIGIN_NOT_ALLOWED);
  });

  it('stage 3 decides on the facts of the seam: a replacement is what it applies', async () => {
    const { app } = await buildGuardApp();
    apps.push(app);
    app.seams.replace('originDecision', () => ({ category: OriginCategory.WEB_CONSOLE, hasCookie: false, hasBearer: false }));
    expect((await app.inject(request('POST', 'none', 'other origin'))).statusCode).toBe(200);
    app.seams.replace('originDecision', () => ({ category: OriginCategory.OTHER, hasCookie: false, hasBearer: false }));
    expect((await app.inject(request('POST', 'none', 'web console origin'))).statusCode).toBe(403);
  });
});

describe('the log of a refusal (SR-48, SR-49)', () => {
  const MARKERS = {
    originPath: 'MARK-origin-path-4be1',
    originQuery: 'MARK-origin-query-90aa',
    cookie: 'MARK-cookie-7d3c',
    authorization: 'MARK-auth-e215',
    query: 'MARK-query-1f08',
    pathParameter: 'MARK-param-c6d4',
    body: 'MARK-body-52b9',
  } as const;

  const log = captureLog();
  let app: FastifyInstance;

  const credentials = {
    cookie: `${SESSION_COOKIE}=${MARKERS.cookie}`,
    authorization: `Bearer ${MARKERS.authorization}`,
  };

  beforeAll(async () => {
    app = (await buildGuardApp({ config: unitTestConfig({ logLevel: 'trace' }), logStream: log.stream })).app;
    const url = `/api/v1/scratch/${MARKERS.pathParameter}?token=${MARKERS.query}`;
    const sent = await Promise.all([
      // 1. A value that is not an origin: it carries a path and a query string.
      app.inject({
        method: 'POST',
        url,
        headers: { ...credentials, origin: `http://evil.example/${MARKERS.originPath}?secret=${MARKERS.originQuery}` },
        payload: { note: MARKERS.body },
      }),
      // 2. A well-formed foreign origin.
      app.inject({ method: 'POST', url, headers: { ...credentials, origin: 'http://localhost:5176' }, payload: { note: MARKERS.body } }),
      // 3. The cookie on a POST without an Origin.
      app.inject({ method: 'POST', url, headers: { cookie: credentials.cookie }, payload: { note: MARKERS.body } }),
      // 4. The literal null on a GET.
      app.inject({ method: 'GET', url, headers: { origin: 'null' } }),
    ]);
    expect(sent.map((response) => response.statusCode)).toEqual([403, 403, 403, 403]);
  });

  afterAll(() => app.close());

  it('holds none of the values the caller sent: no Origin path or query, no cookie, no bearer, no URL, no body', () => {
    const text = log.text();
    expect(text.length).toBeGreaterThan(0);
    for (const [where, marker] of Object.entries(MARKERS)) expect(text, where).not.toContain(marker);
    expect(text).not.toContain('token=');
    expect(text).not.toContain('secret=');
    // The scheme with a value behind it; `hasBearer` is the name of a field, not a header value.
    expect(text).not.toContain('Bearer ');
    expect(text).not.toContain('dvc_');
    expect(text).not.toContain(`${SESSION_COOKIE}=`);
  });

  it('has one request line per refusal with the route pattern, the status and the code', () => {
    const lines = log.lines().filter((line) => line.msg === 'request completed');
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(line.route).toBe(SCRATCH_PATTERN);
      expect(line.status).toBe(403);
      expect(line.code).toBe(ORIGIN_NOT_ALLOWED);
      expect(line.principal).toBeNull();
    }
  });

  it('has one line per refusal that names the cell: kind, category, which credentials were present', () => {
    const lines = log.lines().filter((line) => line.msg === 'request refused by the Origin guard');
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(Object.keys(line).sort()).toEqual(
        ['category', 'code', 'hasBearer', 'hasCookie', 'hostname', 'kind', 'level', 'msg', 'origin', 'pid', 'reqId', 'route', 'time'].sort(),
      );
      expect(line.level).toBe(40);
      expect(line.code).toBe(ORIGIN_NOT_ALLOWED);
      expect(line.route).toBe(SCRATCH_PATTERN);
    }
    const cells = lines
      .map((line) => `${String(line.kind)} ${String(line.category)} cookie=${String(line.hasCookie)} bearer=${String(line.hasBearer)} ${String(line.origin)}`)
      .sort();
    expect(cells).toEqual(
      [
        `COMMAND OTHER cookie=true bearer=true ${UNLOGGABLE_ORIGIN}`,
        'COMMAND OTHER cookie=true bearer=true http://localhost:5176',
        'COMMAND ABSENT cookie=true bearer=false null',
        'READ OTHER cookie=false bearer=false null',
      ].sort(),
    );
  });

  it('a refusal and its request line share the request ID', () => {
    const lines = log.lines();
    const refusals = lines.filter((line) => line.msg === 'request refused by the Origin guard').map((line) => line.reqId);
    const completed = lines.filter((line) => line.msg === 'request completed').map((line) => line.reqId);
    expect([...refusals].sort()).toEqual([...completed].sort());
  });
});
