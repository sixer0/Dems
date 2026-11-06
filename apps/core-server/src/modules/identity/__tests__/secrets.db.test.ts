// AC-B-28, AC-B-29 for the identity core: after the sign-in flows, a full dump of the database
// and a capture of the log at level `trace` hold no password, no session token, no cookie value,
// no device credential and no marker (plan row W24; spec SR-07, SR-09, SR-15, SR-48, SR-49,
// SR-54; database contract §5.4 NL-1 to NL-3).
//
// The values searched for are held by the test only. A failure names a secret by its label and
// the form it was found in, never by its value; this file prints counts and nothing else (P19).
import { createHash } from 'node:crypto';
import { DEMO_OPERATOR_PASSWORD, OPERATOR_IDS, OPERATORS } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { dumpDatabase } from '../../../../test/support/seed';
import { credentialLeaks } from '../../../../test/support/config';
import {
  CLOCK_START,
  MINUTE,
  SESSION,
  SIGN_IN,
  SIGN_OUT,
  STATUS,
  TOUCH,
  WEB_ORIGIN,
  bearer,
  cookieValue,
  deviceRegistryDouble,
  deviceSignIn,
  expectAbsent,
  forgetCounters,
  get,
  identityApp,
  insertPairedDevice,
  occurrences,
  webPost,
  webSignIn,
  type IdentityApp,
} from '../../../../test/support/identity';

const db = useTestDatabase({ template: 'seed' });
let identity: IdentityApp;
let owner: Pool;

const SUPERVISOR = OPERATORS[1]!;
const INVESTIGATOR = OPERATORS[0]!;
const DEVICE = 'DEV-0001';

/** Markers: made-up values that must leave no trace. */
const MARKER_PASSWORD = 'W24-MARKER-pass-7f3a9c';
const MARKER_USERNAME = 'w24.marker-user-5d1e';
const MARKER_QUERY = 'W24-MARKER-query-b82e41';
const MARKER_JSON = 'W24-MARKER-json-0c9d77';
const MARKER_COOKIE = 'W24-MARKER-cookie-4a6f10';

/** Everything the flows used that must be in no dump and no log, by label. */
const secrets: Record<string, string> = {
  'the demo password': DEMO_OPERATOR_PASSWORD,
  'the marker password': MARKER_PASSWORD,
  'the typed unknown username': MARKER_USERNAME,
  'the query marker': MARKER_QUERY,
  'the malformed-JSON marker': MARKER_JSON,
  'the foreign cookie marker': MARKER_COOKIE,
};
const tokens: string[] = [];

beforeAll(async () => {
  owner = db.ownerPool();
  identity = await identityApp(db, { logLevel: 'trace' });
  const devices = deviceRegistryDouble();
  identity.app.seams.replace('deviceResolver', devices.resolver);
  await insertPairedDevice(owner, DEVICE, OPERATOR_IDS.ANDI, CLOCK_START);
  const deviceCredential = devices.pair(DEVICE);
  secrets['the device credential'] = deviceCredential;
  const remember = (label: string, token: string | null | undefined): string => {
    if (typeof token !== 'string' || !/^ses_[A-Za-z0-9_-]{43}$/.test(token)) throw new Error(`${label}: no session token was issued`);
    secrets[label] = token;
    tokens.push(token);
    return token;
  };
  const { app, cookieName } = identity;

  // ── The flows of the identity core ────────────────────────────────────────────────────────
  // A web sign-in, reads with a `?token=` query, activity.
  const first = remember('web session token 1', cookieValue(await webSignIn(app, SUPERVISOR.username), cookieName));
  const cookie = { cookie: `${cookieName}=${first}; other=${MARKER_COOKIE}` };
  await get(app, `${SESSION}?token=${MARKER_QUERY}`, cookie);
  await get(app, `${STATUS}?token=${MARKER_QUERY}&x=${first}`, cookie);
  identity.clock.advance(MINUTE);
  await webPost(app, TOUCH, cookie);

  // Failed attempts: a wrong password for a known and for an unknown username; malformed JSON.
  await webSignIn(app, SUPERVISOR.username, MARKER_PASSWORD);
  await webSignIn(app, MARKER_USERNAME, MARKER_PASSWORD);
  await app.inject({
    method: 'POST',
    url: SIGN_IN,
    headers: { origin: WEB_ORIGIN, 'content-type': 'application/json' },
    payload: `{"username":"${SUPERVISOR.username}","password":"${MARKER_JSON}`,
  });
  await app.inject({ method: 'POST', url: SIGN_IN, headers: { origin: WEB_ORIGIN }, payload: { username: SUPERVISOR.username, password: `${MARKER_JSON}\u0000` } });
  await app.inject({ method: 'POST', url: `${SIGN_IN}?password=${MARKER_QUERY}`, headers: { origin: WEB_ORIGIN }, payload: { username: MARKER_USERNAME } });

  // Rotation: a second sign-in that presents the first session.
  forgetCounters(identity);
  const second = remember('web session token 2', cookieValue(await webSignIn(app, INVESTIGATOR.username, DEMO_OPERATOR_PASSWORD, cookie), cookieName));

  // A device: sign-in, a read, a failure, two credentials at once, a sign-out.
  const device = remember('device session token', ((await deviceSignIn(app, deviceCredential, SUPERVISOR.username)).json() as { sessionToken?: string }).sessionToken);
  await get(app, SESSION, bearer(device));
  await deviceSignIn(app, deviceCredential, SUPERVISOR.username, MARKER_PASSWORD);
  await get(app, SESSION, { ...bearer(device), cookie: `${cookieName}=${second}` });
  await app.inject({ method: 'POST', url: SIGN_OUT, headers: bearer(device) });

  // The lock, with the right and with a wrong password; then an expiry and a sign-out.
  for (let attempt = 0; attempt < 6; attempt += 1) await webSignIn(app, SUPERVISOR.username, MARKER_PASSWORD);
  await webSignIn(app, SUPERVISOR.username);
  forgetCounters(identity);
  const third = remember('web session token 3', cookieValue(await webSignIn(app, SUPERVISOR.username), cookieName));
  identity.clock.advance(15 * MINUTE);
  await get(app, SESSION, { cookie: `${cookieName}=${third}` });
  await identity.control.sweep();
  forgetCounters(identity);
  const fourth = remember('web session token 4', cookieValue(await webSignIn(app, SUPERVISOR.username), cookieName));
  await webPost(app, SIGN_OUT, { cookie: `${cookieName}=${fourth}` });
});

describe('AC-B-28: a full dump of the database after the identity flows', () => {
  it('holds no password, no token, no credential, no typed username and no marker; only the hash of each token', async () => {
    const dump = await dumpDatabase(owner);
    expectAbsent(dump, secrets);

    // The search is not vacuous: the dump is the whole database, hash columns included, and the
    // SHA-256 of every issued token is in it exactly once.
    expect(dump.length).toBeGreaterThan(100_000);
    expect(tokens).toHaveLength(5);
    const sessionRows = /-- auth_sessions: (\d+) row\(s\)/.exec(dump)?.[1];
    expect(Number(sessionRows)).toBe(tokens.length);
    for (const token of tokens) {
      const digest = createHash('sha256').update(token, 'utf8').digest('hex');
      expect(occurrences(dump, `\\\\x${digest}`)).toBe(1);
    }
    // And the flows are in it: the rows this file's requests wrote (the seed's own rows are older).
    const { rows: written } = await owner.query<{ type: string; n: string }>(
      "SELECT type, count(*) AS n FROM public.audit_log WHERE type LIKE 'AUTH_%' AND at >= $1 GROUP BY type ORDER BY type",
      [CLOCK_START],
    );
    expect(Object.fromEntries(written.map((row) => [row.type, Number(row.n)]))).toEqual({
      AUTH_EXPIRED: 2,
      AUTH_FAILED: 8,
      AUTH_LOCKED: 2,
      AUTH_SIGNED_OUT: 2,
      AUTH_SUCCESS: 5,
    });
    console.info(
      `[w24] AC-B-28 dump of ${db.name}: ${dump.length} characters; ${Object.keys(secrets).length} secrets and markers searched in 6 forms each, 0 found; ` +
        `${tokens.length} session tokens issued, ${sessionRows ?? '?'} rows in auth_sessions, each token's SHA-256 present once`,
    );
  });

  it('no audit row and no event names a secret, in its details, its message or a reference', async () => {
    const { rows: audit } = await owner.query<{ line: string }>('SELECT to_jsonb(t)::text AS line FROM public.audit_log AS t');
    const { rows: events } = await owner.query<{ line: string }>('SELECT to_jsonb(t)::text AS line FROM public.events AS t');
    expectAbsent([...audit, ...events].map((row) => row.line).join('\n'), secrets);
    // The detail keys the identity rows use, all of them.
    const { rows: keys } = await owner.query<{ key: string }>(
      "SELECT DISTINCT jsonb_object_keys(details) AS key FROM public.audit_log WHERE type LIKE 'AUTH_%' AND at >= $1 ORDER BY 1",
      [CLOCK_START],
    );
    expect(keys.map((row) => row.key)).toEqual(['attemptsRemaining', 'knownOperator', 'lockedUntil', 'method', 'reason', 'replaced', 'retryInMs']);
  });
});

describe('AC-B-29: the log of the same flows, captured at level trace', () => {
  it('holds none of the values, no cookie value and no marker', () => {
    const text = identity.log.text();
    expectAbsent(text, secrets);
    expect(credentialLeaks(text)).toEqual([]);
    // Not vacuous: the flows are in it.
    const completed = identity.log.lines().filter((line) => line['msg'] === 'request completed');
    expect(completed.length).toBeGreaterThanOrEqual(25);
    console.info(`[w24] AC-B-29 log capture: ${text.length} characters, ${identity.log.lines().length} lines, ${completed.length} request lines; 0 secrets, 0 markers, 0 credential-shaped values`);
  });

  it('no request line holds a query string: the route is the registry\'s pattern', () => {
    const routes = identity.log
      .lines()
      .filter((line) => line['msg'] === 'request completed')
      .map((line) => String(line['route']));
    expect(routes.filter((route) => route.includes('?') || route.includes('='))).toEqual([]);
    expect(new Set(routes)).toEqual(new Set([SIGN_IN, STATUS, SESSION, SIGN_OUT, TOUCH]));
    expect(identity.log.text().includes('token=')).toBe(false);
  });

  it('a parse or validation failure of signIn is logged by its code only', () => {
    const failures = identity.log.lines().filter((line) => line['msg'] === 'request completed' && line['route'] === SIGN_IN && [400, 422].includes(Number(line['status'])));
    expect(failures.map((line) => line['code']).sort()).toEqual(['INVALID_INPUT', 'INVALID_INPUT', 'INVALID_JSON']);
    for (const line of failures) expect(Object.keys(line).sort()).toEqual(['code', 'durationMs', 'hostname', 'level', 'method', 'msg', 'pid', 'principal', 'reqId', 'route', 'status', 'time']);
  });

  it('the principal of a request line is an operator ID or a device ID, never a session', () => {
    const principals = new Set(identity.log.lines().filter((line) => line['msg'] === 'request completed').map((line) => line['principal']));
    for (const principal of principals) {
      expect(principal === null || /^(operator:OPR-\d{3}|device:DEV-\d{4})$/.test(String(principal))).toBe(true);
    }
    expect(principals.has(`operator:${SUPERVISOR.id}`)).toBe(true);
    expect(principals.has(`device:${DEVICE}`)).toBe(true);
  });
});
