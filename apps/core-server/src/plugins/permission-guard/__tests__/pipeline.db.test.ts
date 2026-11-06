// Stages 3 to 6 of the request pipeline together, against PostgreSQL (plan row W28; spec §2.3,
// §7.3, §14.2, §5.2 ID-1, ID-12; SR-69, SR-75; AC-B-43, AC-B-73 (HTTP table), AC-B-74, AC-B-84
// (REST); decision D69).
//
// The real app factory on a clone of the seed, as `dems_app`, on a manual clock. NO STAGE IS
// REPLACED: the Origin guard, `authenticate`, the throttle with the denial budget and the access
// rule are the server's own, in the server's order. Sessions are real: an operator signs in with
// the seeded credential, on the web (the cookie) and on a paired device (a bearer value). The
// one stand-in is the device registry behind the seam `deviceResolver`, which the test steers.
//
// THE APP HAS NO DOMAIN MODULE (decision D85): `without-domain-modules` is the first import, so
// the eleven domain modules and the realtime channel add no route, whichever of them have
// landed. The operations a test calls get a stand-in route built from their registry entry, so
// the rule that is applied is the registry's, and a stand-in never stands beside a module's
// route. Every STAGE is the server's own.
//
// No credential is printed: a token is taken from an answer and handed on in a header.
import './without-domain-modules';
import { randomBytes } from 'node:crypto';
import { WS_PATH } from '@dems/shared/api';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, OPERATOR_IDS } from '@dems/shared/sim';
import type { InjectOptions, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readTrail } from '../../../../test/support/core';
import { WEB_CONSOLE_KEY, identityControl } from '../../../modules/identity';
import {
  CLOCK_START,
  FOREIGN_ORIGIN,
  OWN_ORIGIN,
  SESSION,
  SIGN_IN,
  STATUS,
  TOUCH,
  WEB_ORIGIN,
  bearer,
  errorOf,
  insertPairedDevice,
  type Headers,
} from '../../../../test/support/identity';
import { credentialLeaks } from '../../../../test/support/config';
import { throttleControl } from '../../throttle';
import { channelRoute, deviceOperator, guardApp, outcome, webOperator, type GuardApp } from '../../../../test/support/guard';

const db = useTestDatabase({ template: 'seed' });
let guard: GuardApp;
let owner: Pool;
/** The session cookie of the SUPERVISOR on the web console. */
let cookie: Headers;
/** The session token of the INVESTIGATOR on the paired device, as a bearer header. */
let token: Headers;
/** The device credential of the paired device, as a bearer header. */
let device: Headers;
/** Every answer of this file, for the last test: none carries a CORS header. */
const answers: LightMyRequestResponse[] = [];

const INVESTIGATOR = OPERATORS[0]!;
const SUPERVISOR = OPERATORS[1]!;
const DEVICE = 'DEV-0001';
const RETIRED_DEVICE = 'DEV-0002';

async function send(request: InjectOptions): Promise<LightMyRequestResponse> {
  const response = await guard.app.inject(request);
  answers.push(response);
  return response;
}

/**
 * A handshake request to the socket route: its status, and who stage 4 made of the caller, read
 * from the record of what passed stage 6 (null when a stage refused it).
 */
async function handshake(headers: Headers): Promise<[number, string | null]> {
  const before = guard.passed.length;
  const response = await send({ method: 'GET', url: WS_PATH, headers });
  const record = guard.passed.length > before ? guard.passed.at(-1) : undefined;
  return [response.statusCode, record?.route === `GET ${WS_PATH}` ? record.principal : null];
}

beforeAll(async () => {
  owner = db.ownerPool();
  guard = await guardApp(db, {
    routes: (instance) => {
      // The socket route is the realtime row's (W42), whose unit adds no route in this file's
      // app. This stand-in only shows that stages 3 to 6 let the handshake request of each
      // caller through; `inject` performs no upgrade. What stage 4 made of the caller is read
      // from `guard.passed`, the record of every request that passed stage 6.
      expect(channelRoute(instance)).toBe(true);
    },
  });
  await insertPairedDevice(owner, DEVICE, OPERATOR_IDS.ANDI, CLOCK_START);
  await insertPairedDevice(owner, RETIRED_DEVICE, OPERATOR_IDS.ANDI, CLOCK_START);
  const credential = guard.devices.pair(DEVICE);
  device = bearer(credential);
  cookie = await webOperator(guard, SUPERVISOR.username);
  token = await deviceOperator(guard, credential, INVESTIGATOR.username);
});

beforeEach(() => {
  // Each test starts with fresh throttle windows, denial budgets and sign-in lockouts.
  throttleControl(guard.app).reset();
  identityControl(guard.app).lockout.reset();
});

// ── The decision table for HTTP requests (spec §14.2) ──────────────────────────────────────────

const ORIGINS = {
  1: { label: 'no Origin', header: undefined },
  2: { label: "one of the instance's own origins", header: OWN_ORIGIN },
  3: { label: 'a web console origin', header: WEB_ORIGIN },
  4: { label: 'any other origin', header: FOREIGN_ORIGIN },
  5: { label: 'the literal null', header: 'null' },
} as const;
type Column = keyof typeof ORIGINS;
type Row = 'C' | 'B' | 'N' | 'X';

const ROWS: Record<Row, string> = { C: 'cookie', B: 'bearer', N: 'no credential', X: 'cookie and bearer' };

function credentialsOf(row: Row): Headers {
  if (row === 'C') return cookie;
  if (row === 'B') return token;
  if (row === 'X') return { ...cookie, ...token };
  return {};
}

function headersOf(row: Row, column: Column): Headers {
  const origin = ORIGINS[column].header;
  return { ...credentialsOf(row), ...(origin === undefined ? {} : { origin }) };
}

/** `[status, code]`: what the cell of the table answers. */
type Answer = readonly [status: number, code: string | null];
const OK: Answer = [200, null];
const ORIGIN_REFUSED: Answer = [403, 'ORIGIN_NOT_ALLOWED'];
const CONFLICT: Answer = [401, 'NOT_SIGNED_IN'];
const NOT_SIGNED_IN: Answer = [401, 'NOT_SIGNED_IN'];
const NOT_PAIRED: Answer = [403, 'DEVICE_NOT_PAIRED'];

interface Cell {
  /** `H-<row><column>-<method>`: the row and the column of the table of spec §14.2. */
  readonly id: string;
  readonly row: Row;
  readonly column: Column;
  readonly method: 'GET' | 'POST';
  readonly operation: 'getAuthSession' | 'touchSession' | 'getSignInStatus' | 'signIn';
  readonly answer: Answer;
  /** The stage that decides the cell. */
  readonly stage: 3 | 4 | 6 | 'handler';
  /** The words of the table. */
  readonly table: string;
}

const URL_OF = { getAuthSession: SESSION, touchSession: TOUCH, getSignInStatus: STATUS, signIn: SIGN_IN } as const;

function cell(row: Row, column: Column, method: 'GET' | 'POST', answer: Answer, stage: Cell['stage'], table: string, operation?: Cell['operation']): Cell {
  const anonymous = row === 'N';
  return {
    id: `H-${row}${column}-${method}`,
    row,
    column,
    method,
    operation: operation ?? (method === 'GET' ? (anonymous ? 'getSignInStatus' : 'getAuthSession') : anonymous ? 'signIn' : 'touchSession'),
    answer,
    stage,
    table,
  };
}

/** Every cell of the table: 4 credential rows, 4 origin columns (the fourth with both of its values), GET and POST. */
const CELLS: readonly Cell[] = [
  // Cookie
  cell('C', 1, 'GET', OK, 'handler', 'GET: accepted (OR-3)'),
  cell('C', 1, 'POST', ORIGIN_REFUSED, 3, 'POST: 403 (OR-2)'),
  cell('C', 2, 'GET', ORIGIN_REFUSED, 3, '403'),
  cell('C', 2, 'POST', ORIGIN_REFUSED, 3, '403'),
  cell('C', 3, 'GET', OK, 'handler', 'Accepted'),
  cell('C', 3, 'POST', OK, 'handler', 'Accepted'),
  cell('C', 4, 'GET', ORIGIN_REFUSED, 3, '403'),
  cell('C', 4, 'POST', ORIGIN_REFUSED, 3, '403'),
  cell('C', 5, 'GET', ORIGIN_REFUSED, 3, '403 (null)'),
  cell('C', 5, 'POST', ORIGIN_REFUSED, 3, '403 (null)'),
  // Bearer
  cell('B', 1, 'GET', OK, 'handler', 'Accepted (OR-4)'),
  cell('B', 1, 'POST', OK, 'handler', 'Accepted (OR-4)'),
  cell('B', 2, 'GET', OK, 'handler', 'Accepted (OR-4)'),
  cell('B', 2, 'POST', OK, 'handler', 'Accepted (OR-4)'),
  cell('B', 3, 'GET', ORIGIN_REFUSED, 3, '403 (OR-4)'),
  cell('B', 3, 'POST', ORIGIN_REFUSED, 3, '403 (OR-4)'),
  cell('B', 4, 'GET', ORIGIN_REFUSED, 3, '403'),
  cell('B', 4, 'POST', ORIGIN_REFUSED, 3, '403'),
  cell('B', 5, 'GET', ORIGIN_REFUSED, 3, '403 (null)'),
  cell('B', 5, 'POST', ORIGIN_REFUSED, 3, '403 (null)'),
  // None
  cell('N', 1, 'GET', OK, 'handler', "Accepted as ANONYMOUS; getSignInStatus reports the web console's lock state"),
  cell('N', 1, 'POST', NOT_PAIRED, 6, 'signIn answers 403 DEVICE_NOT_PAIRED (ID-1)'),
  cell('N', 2, 'GET', OK, 'handler', 'Accepted as ANONYMOUS; getSignInStatus as in the first column'),
  cell('N', 2, 'POST', NOT_PAIRED, 6, 'not a web console: signIn answers 403 DEVICE_NOT_PAIRED'),
  cell('N', 3, 'GET', OK, 'handler', 'Accepted as ANONYMOUS'),
  cell('N', 3, 'POST', OK, 'handler', 'a web console for ID-1 (a): signIn is accepted'),
  cell('N', 4, 'GET', ORIGIN_REFUSED, 3, '403'),
  cell('N', 4, 'POST', ORIGIN_REFUSED, 3, '403'),
  cell('N', 5, 'GET', ORIGIN_REFUSED, 3, '403 (null)'),
  cell('N', 5, 'POST', ORIGIN_REFUSED, 3, '403 (null)'),
  // Cookie and bearer
  cell('X', 1, 'GET', CONFLICT, 4, 'GET: 401 NOT_SIGNED_IN with CREDENTIAL_CONFLICT (ID-12)'),
  cell('X', 1, 'POST', ORIGIN_REFUSED, 3, 'POST: 403'),
  cell('X', 2, 'GET', ORIGIN_REFUSED, 3, '403'),
  cell('X', 2, 'POST', ORIGIN_REFUSED, 3, '403'),
  cell('X', 3, 'GET', CONFLICT, 4, '401 NOT_SIGNED_IN with CREDENTIAL_CONFLICT'),
  cell('X', 3, 'POST', CONFLICT, 4, '401 NOT_SIGNED_IN with CREDENTIAL_CONFLICT'),
  cell('X', 4, 'GET', ORIGIN_REFUSED, 3, '403'),
  cell('X', 4, 'POST', ORIGIN_REFUSED, 3, '403'),
  cell('X', 5, 'GET', ORIGIN_REFUSED, 3, '403 (null)'),
  cell('X', 5, 'POST', ORIGIN_REFUSED, 3, '403 (null)'),
];

function requestOf(target: Cell): InjectOptions {
  const headers = headersOf(target.row, target.column);
  if (target.operation === 'signIn') {
    return { method: 'POST', url: SIGN_IN, headers, payload: { username: SUPERVISOR.username, password: DEMO_OPERATOR_PASSWORD } };
  }
  return { method: target.method, url: URL_OF[target.operation], headers };
}

describe('AC-B-73: the decision table for HTTP requests of spec §14.2, through the real stages 3 to 6', () => {
  it('has 40 cells: 4 credential rows x 5 origin values x GET and POST, each with an ID of its own', () => {
    expect(CELLS).toHaveLength(40);
    expect(new Set(CELLS.map((target) => target.id)).size).toBe(40);
    for (const row of Object.keys(ROWS) as Row[]) for (const column of [1, 2, 3, 4, 5] as const) for (const method of ['GET', 'POST'] as const) {
      expect(CELLS.some((target) => target.id === `H-${row}${column}-${method}`)).toBe(true);
    }
  });

  it.each(CELLS.map((target) => [target.id, ROWS[target.row], ORIGINS[target.column].label, target.method, target.operation, target.answer[0], target.answer[1] ?? 'no error', target] as const))(
    '%s %s, %s, %s %s: %i %s',
    async (_id, _row, _origin, _method, _operation, _status, _code, target) => {
      const before = (await readTrail(owner)).length;
      const response = await send(requestOf(target));
      expect(outcome(response)).toEqual([...target.answer]);

      if (target.stage === 4) expect(errorOf(response).details).toEqual({ reason: 'CREDENTIAL_CONFLICT' });
      if (target.answer[0] === 200 && target.operation === 'getAuthSession') {
        // The session of the credential that was sent: the stages resolved it and let it through.
        const operatorId = (response.json() as { operator: { id: string } }).operator.id;
        expect(operatorId).toBe(target.row === 'C' ? SUPERVISOR.id : INVESTIGATOR.id);
      }
      if (target.answer[0] === 200 && target.operation === 'getSignInStatus') {
        // GS-29: the web console's lock state, whatever the Origin of the anonymous caller.
        expect(response.json()).toMatchObject({ locked: false, attemptsRemaining: 5 });
      }
      // No cell of this table is a refusal for a missing permission: only an accepted sign-in writes a row.
      const written = (await readTrail(owner)).slice(before).map((row) => row.type);
      expect(written).toEqual(target.id === 'H-N3-POST' ? ['AUTH_SUCCESS'] : []);
      // No cell sets a cookie, except the web console's sign-in.
      expect(response.headers['set-cookie'] !== undefined).toBe(target.id === 'H-N3-POST');
    },
  );

  it('the None row beyond the two entry points: an anonymous caller on an AUTHENTICATED operation answers 401 from stage 6, whatever the allowed Origin', async () => {
    for (const column of [1, 2, 3] as const) {
      expect(outcome(await send({ method: 'GET', url: SESSION, headers: headersOf('N', column) }))).toEqual([...NOT_SIGNED_IN]);
    }
    // The POST of a signed-out web console: its Origin is allowed, and stage 6 answers.
    expect(outcome(await send({ method: 'POST', url: TOUCH, headers: headersOf('N', 3) }))).toEqual([...NOT_SIGNED_IN]);
    expect(outcome(await send({ method: 'POST', url: TOUCH, headers: headersOf('N', 1) }))).toEqual([...NOT_SIGNED_IN]);
  });

  it('SR-69: signIn with the own origin and no bearer answers 403 DEVICE_NOT_PAIRED before the body is read: no attempt is taken and no row is written', async () => {
    const before = (await readTrail(owner)).length;
    // Stage 6 itself refuses, not only the identity module's own check behind it: the stage's line says so.
    const refusedByStage = (): number =>
      guard.log.lines().filter((line) => line['msg'] === 'request refused by the access rule' && line['operationId'] === 'signIn' && line['refusedBy'] === 'CONSOLE_IDENTITY').length;
    const linesBefore = refusedByStage();
    for (const body of [{ username: SUPERVISOR.username, password: DEMO_OPERATOR_PASSWORD }, { username: 'x' }, 'not json at all {']) {
      const response = await send({
        method: 'POST',
        url: SIGN_IN,
        headers: { origin: OWN_ORIGIN, 'content-type': 'application/json' },
        payload: typeof body === 'string' ? body : JSON.stringify(body),
      });
      expect(outcome(response)).toEqual([...NOT_PAIRED]);
    }
    expect((await readTrail(owner)).length).toBe(before);
    expect(refusedByStage()).toBe(linesBefore + 3);
    expect(await identityControl(guard.app).lockout.status(WEB_CONSOLE_KEY, guard.clock.now())).toMatchObject({ attemptsRemaining: 5, locked: false });
    // The same body from a web console origin signs in: pairing is what was missing, nothing else.
    const web = await send({ method: 'POST', url: SIGN_IN, headers: { origin: WEB_ORIGIN }, payload: { username: SUPERVISOR.username, password: DEMO_OPERATOR_PASSWORD } });
    expect(web.statusCode).toBe(200);
  });

  it('a paired device is the other console of ID-1: signIn with its credential and the own origin, or no Origin, is accepted', async () => {
    for (const origin of [undefined, OWN_ORIGIN]) {
      const response = await send({
        method: 'POST',
        url: SIGN_IN,
        headers: { ...device, ...(origin === undefined ? {} : { origin }) },
        payload: { username: INVESTIGATOR.username, password: DEMO_OPERATOR_PASSWORD },
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['set-cookie']).toBeUndefined();
    }
  });
});

describe('AC-B-43 and AC-B-74: the Origin of a command', () => {
  it('AC-B-43: a POST with a foreign Origin, with the cookie and no Origin, and with the cookie and the own origin each answer 403', async () => {
    expect(outcome(await send({ method: 'POST', url: TOUCH, headers: { ...cookie, origin: FOREIGN_ORIGIN } }))).toEqual([...ORIGIN_REFUSED]);
    expect(outcome(await send({ method: 'POST', url: SIGN_IN, headers: { origin: FOREIGN_ORIGIN }, payload: {} }))).toEqual([...ORIGIN_REFUSED]);
    expect(outcome(await send({ method: 'POST', url: TOUCH, headers: cookie }))).toEqual([...ORIGIN_REFUSED]);
    expect(outcome(await send({ method: 'POST', url: TOUCH, headers: { ...cookie, origin: OWN_ORIGIN } }))).toEqual([...ORIGIN_REFUSED]);
    // The control: the same POST with a web console origin is accepted.
    expect((await send({ method: 'POST', url: TOUCH, headers: { ...cookie, origin: WEB_ORIGIN } })).statusCode).toBe(200);
  });

  it.each(['http://localhost:5173', 'null', 'http://127.0.0.1:5173/', 'HTTP://127.0.0.1:5173', 'http://127.0.0.1:5174'])(
    'AC-B-74: %s as Origin answers 403 ORIGIN_NOT_ALLOWED on a POST, with the cookie and without a credential, and on the handshake request of the socket',
    async (origin) => {
      // The handshake request passes the same stage 3 (the real upgrade is the realtime row's, W42).
      const upgrade = { upgrade: 'websocket', connection: 'Upgrade', origin };
      expect(outcome(await send({ method: 'GET', url: WS_PATH, headers: upgrade }))).toEqual([...ORIGIN_REFUSED]);
      expect(outcome(await send({ method: 'GET', url: WS_PATH, headers: { ...token, ...upgrade } }))).toEqual([...ORIGIN_REFUSED]);
      expect(outcome(await send({ method: 'POST', url: TOUCH, headers: { ...cookie, origin } }))).toEqual([...ORIGIN_REFUSED]);
      expect(outcome(await send({ method: 'POST', url: SIGN_IN, headers: { origin }, payload: { username: SUPERVISOR.username, password: DEMO_OPERATOR_PASSWORD } }))).toEqual([
        ...ORIGIN_REFUSED,
      ]);
    },
  );
});

describe('decision D69: what the mobile app sends, as it was measured on the emulator', () => {
  const OKHTTP = { host: '127.0.0.1:4420', 'user-agent': 'okhttp/4.12.0' };

  it('a REST call has no Origin, Host 127.0.0.1:4420 and User-Agent okhttp: accepted with the bearer session, a GET and a POST', async () => {
    const read = await send({ method: 'GET', url: SESSION, headers: { ...token, ...OKHTTP } });
    expect(read.statusCode).toBe(200);
    expect((read.json() as { operator: { id: string }; deviceId: string | null })).toMatchObject({ operator: { id: INVESTIGATOR.id }, deviceId: DEVICE });
    expect((await send({ method: 'POST', url: TOUCH, headers: { ...token, ...OKHTTP } })).statusCode).toBe(200);
    expect(read.headers['set-cookie']).toBeUndefined();
  });

  it('nothing keys on Host or User-Agent: any value of either, or none, gives the same answer for the bearer session and for an anonymous caller', async () => {
    const variants: Headers[] = [
      OKHTTP,
      { host: '127.0.0.1:4421', 'user-agent': 'okhttp/4.12.0' },
      { host: 'core.example.invalid', 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64)' },
      { host: '127.0.0.1:4420' },
      {},
    ];
    for (const variant of variants) {
      expect(outcome(await send({ method: 'GET', url: SESSION, headers: { ...token, ...variant } }))).toEqual([200, null]);
      expect(outcome(await send({ method: 'GET', url: SESSION, headers: variant }))).toEqual([...NOT_SIGNED_IN]);
      expect(outcome(await send({ method: 'POST', url: SIGN_IN, headers: variant, payload: {} }))).toEqual([...NOT_PAIRED]);
    }
  });

  it('the socket upgrade carries Origin http://127.0.0.1:4420 and the bearer value: stages 3 to 6 let the handshake request through, also beside a foreign cookie', async () => {
    const upgrade = { upgrade: 'websocket', connection: 'Upgrade', origin: OWN_ORIGIN, ...OKHTTP };
    expect(await handshake({ ...token, ...upgrade })).toEqual([200, 'OPERATOR']);
    expect(await handshake({ ...device, ...upgrade })).toEqual([200, 'DEVICE']);
    // F55: React Native's socket also sends what its cookie store holds for the host; another
    // instance's cookie and an unrelated one are no credential and no conflict.
    expect(await handshake({ ...token, ...upgrade, cookie: 'dems_session_4421=abc; theme=dark' })).toEqual([200, 'OPERATOR']);
  });

  it('the handshake request is open at stage 6 to every caller that passed stage 3: anonymous, an unknown bearer value, a retired device; none writes a row', async () => {
    const before = (await readTrail(owner)).length;
    const upgrade = { upgrade: 'websocket', connection: 'Upgrade' };
    const retired = bearer(guard.devices.pair(RETIRED_DEVICE));
    guard.devices.retire(RETIRED_DEVICE);
    const unknown = bearer(`ses_${randomBytes(32).toString('base64url')}`);
    for (const headers of [{}, { origin: OWN_ORIGIN }, { origin: WEB_ORIGIN }, unknown, retired]) {
      expect(await handshake({ ...headers, ...upgrade })).toEqual([200, 'ANONYMOUS']);
    }
    // Stage 3 still decides the upgrade: a cookie needs a web console origin, a foreign origin is refused.
    expect(outcome(await send({ method: 'GET', url: WS_PATH, headers: { ...cookie, ...upgrade } }))).toEqual([...ORIGIN_REFUSED]);
    expect(outcome(await send({ method: 'GET', url: WS_PATH, headers: { origin: FOREIGN_ORIGIN, ...upgrade } }))).toEqual([...ORIGIN_REFUSED]);
    expect(await handshake({ ...cookie, origin: WEB_ORIGIN, ...upgrade })).toEqual([200, 'OPERATOR']);
    // A refused handshake request never passed stage 6.
    expect(await handshake({ origin: FOREIGN_ORIGIN, ...upgrade })).toEqual([403, null]);
    expect((await readTrail(owner)).length).toBe(before);
    expect(await throttleControl(guard.app).inspect('class:local')).toMatchObject({ used: 0 });
  });
});

describe('AC-B-84 (REST), SR-75: the throttle key is the resolved principal or a class', () => {
  it('31 requests with 31 different unknown bearer values share one bucket: 30 answer 401 from stage 6 and the 31st answers 429 from stage 5', async () => {
    const before = (await readTrail(owner)).length;
    const statuses: Array<[number, string | null]> = [];
    const values = new Set<string>();
    for (let call = 0; call < 31; call += 1) {
      const value = `ses_${randomBytes(32).toString('base64url')}`;
      values.add(value);
      statuses.push(outcome(await send({ method: 'GET', url: SESSION, headers: bearer(value) })));
    }
    expect(values.size).toBe(31);
    expect(statuses.slice(0, 30)).toEqual(Array.from({ length: 30 }, () => [401, 'NOT_SIGNED_IN']));
    expect(statuses[30]).toEqual([429, 'RATE_LIMITED']);
    // A 401 writes no row and takes no place in the denial budget (RB-6).
    expect((await readTrail(owner)).length).toBe(before);
    expect(await throttleControl(guard.app).inspect('class:local')).toMatchObject({ used: 0 });
    // The class is used up for every caller without a principal, and for nobody else.
    expect(outcome(await send({ method: 'GET', url: STATUS }))).toEqual([429, 'RATE_LIMITED']);
    expect((await send({ method: 'GET', url: SESSION, headers: token })).statusCode).toBe(200);
    expect((await send({ method: 'GET', url: SESSION, headers: cookie })).statusCode).toBe(200);
    // 60 s later, by the server clock, the class is counted afresh.
    guard.clock.advance(60_000);
    expect(outcome(await send({ method: 'GET', url: STATUS }))).toEqual([200, null]);
  });

  it('a resolved operator is counted under its own key: 31 requests of one session are all answered', async () => {
    const statuses: number[] = [];
    for (let call = 0; call < 31; call += 1) statuses.push((await send({ method: 'GET', url: SESSION, headers: token })).statusCode);
    expect(statuses).toEqual(Array.from({ length: 31 }, () => 200));
  });
});

describe('what no answer and no log line of this file holds', () => {
  it('OR-5: no answer carries an Access-Control-Allow-* header, accepted or refused', () => {
    expect(answers.length).toBeGreaterThan(100);
    const withCors = answers.filter((response) => Object.keys(response.headers).some((name) => name.toLowerCase().startsWith('access-control-')));
    expect(withCors).toEqual([]);
  });

  it('the log holds no credential: no bearer value, no token, no cookie value', () => {
    expect(guard.log.lines().length).toBeGreaterThan(100);
    expect(credentialLeaks(guard.log.text())).toEqual([]);
  });
});
