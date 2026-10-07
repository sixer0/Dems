// AC-B-29 (the biometric flow) and AC-B-28 for the biometric tokens: after a whole journey of
// enrolments, sign-ins, rotations, a reuse, refusals of every kind, failure reports and a lock,
// no audit row, no event, no publication, no answer of a refusal, no line of the log captured at
// level `trace` and no row of a full dump of the database holds a biometric token, a session
// token or a device credential (plan row W41; spec SR-36, SR-48, SR-54; database contract §5.4
// NL-1 to NL-3, §5.5; rule M14).
//
// The values searched for are held by the test only. A failure names a secret by its label and
// the form it was found in, never by its value; this file prints counts and nothing else (P19).
import { createHash } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { dumpDatabase } from '../../../../../test/support/seed';
import { credentialLeaks } from '../../../../../test/support/config';
import { CLOCK_START, MINUTE, SESSION, STATUS, expectAbsent, occurrences } from '../../../../../test/support/identity';
import { deviceGet } from '../../../../../test/support/pairing';
import {
  BIO_FORM,
  BIOMETRIC,
  BIOMETRIC_FAILURE,
  BIOMETRIC_SIGN_IN,
  INVESTIGATOR,
  TECHNICIAN,
  THIRTY_DAYS,
  biometricApp,
  biometricSignIn,
  devicePost,
  forgetLimits,
  madeUpToken,
  pairDevice,
  passwordSession,
  reportFailure,
  setEnrolment,
  stateOf,
  storedTokens,
  supervisorCookie,
  tokenRow,
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
let dumpBefore = '';

/** Markers: made-up values that must leave no trace in a log line. */
const MARKER_QUERY = 'W41-MARKER-query-7e2c91';
const MARKER_JSON = 'W41-MARKER-json-40bd5a';
const MARKER_FIELD = 'W41-MARKER-field-c38f06';

/** Everything of the journey that must be in no row, no publication, no answer of a refusal and no log line, by label. */
const issued: Record<string, string> = {};
const presented: Record<string, string> = {};
const others: Record<string, string> = {};
const markers: Record<string, string> = { 'the query marker': MARKER_QUERY, 'the malformed-JSON marker': MARKER_JSON, 'the refused-field marker': MARKER_FIELD };
/** The bodies of every answer that was a refusal or a failure. */
const refusals: string[] = [];
/** The bodies of the answers that carry no secret by the contract: a disabled enrolment, a failure report. */
const plainAnswers: string[] = [];
const failedStatements: Array<[string, number, string]> = [];

const sha256Hex = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
const keep = (response: LightMyRequestResponse): LightMyRequestResponse => {
  if (response.statusCode >= 400) refusals.push(response.body);
  return response;
};
const allSecrets = (): Record<string, string> => ({ ...issued, ...presented, ...others });

beforeAll(async () => {
  owner = db.ownerPool();
  bio = await biometricApp(db, { logLevel: 'trace' });
  dumpBefore = await dumpDatabase(owner);
  const { app } = bio;
  const cookie = await supervisorCookie(bio);
  tablet = await pairDevice(bio, cookie, 'Interview tablet 01');
  phone = await pairDevice(bio, cookie, 'Second tablet');
  others['the tablet\'s device credential'] = tablet.credential;
  others['the phone\'s device credential'] = phone.credential;

  const session = async (label: string, device: PairedTestDevice, username: string): Promise<string> => {
    const sessionToken = await passwordSession(app, device, username);
    others[label] = sessionToken;
    return sessionToken;
  };
  const enrolIn = async (label: string, sessionToken: string): Promise<string> => {
    const body = (await setEnrolment(app, sessionToken, { enabled: true })).json() as { token?: string };
    if (typeof body.token !== 'string' || !BIO_FORM.test(body.token)) throw new Error(`${label}: no biometric token was issued`);
    issued[label] = body.token;
    return body.token;
  };
  const signIn = async (label: string, credential: string, token: string): Promise<{ sessionToken: string; biometricToken: string }> => {
    const response = await biometricSignIn(app, credential, token);
    if (response.statusCode !== 200) throw new Error(`${label}: the biometric sign-in answered ${response.statusCode}`);
    const body = response.json() as { sessionToken: string; biometricToken: string };
    issued[`${label}: the next token`] = body.biometricToken;
    others[`${label}: the session token`] = body.sessionToken;
    return body;
  };

  // ── Enrolment, two rotations, the session in use ───────────────────────────────────────────
  const investigator = await session('the investigator\'s password session', tablet, INVESTIGATOR.username);
  const first = await enrolIn('enrolment 1', investigator);
  bio.clock.advance(MINUTE);
  const one = await signIn('sign-in 1', tablet.credential, first);
  const two = await signIn('sign-in 2', tablet.credential, one.biometricToken);
  await deviceGet(app, SESSION, two.sessionToken);
  // A token in a query string authenticates nothing and is logged nowhere.
  keep(await devicePost(app, `${BIOMETRIC_SIGN_IN}?token=${two.biometricToken}&marker=${MARKER_QUERY}`, tablet.credential, { token: '' }));
  await deviceGet(app, `${STATUS}?bio=${two.biometricToken}&token=${MARKER_QUERY}`, tablet.credential);

  // ── The reuse: the family is revoked and two sessions end ──────────────────────────────────
  keep(await biometricSignIn(app, tablet.credential, first));
  keep(await biometricSignIn(app, tablet.credential, two.biometricToken)); // revoked with its family

  // ── Refusals of every kind ─────────────────────────────────────────────────────────────────
  presented['a made-up token'] = madeUpToken('Z');
  keep(await biometricSignIn(app, tablet.credential, presented['a made-up token']));
  forgetLimits(bio);
  const technician = await session('the technician\'s password session', phone, TECHNICIAN.username);
  const onPhone = await enrolIn('enrolment 2 (the phone)', technician);
  keep(await biometricSignIn(app, tablet.credential, onPhone)); // another device's, live: handled as a reuse (CPS1-7), its family is revoked
  keep(await biometricSignIn(app, onPhone, onPhone)); // the token as a bearer value
  keep(await biometricSignIn(app, null, onPhone)); // no credential at all
  const replaced = await enrolIn('enrolment 3 (replaces 2)', technician);
  keep(await biometricSignIn(app, phone.credential, onPhone)); // revoked by the reuse before the new enrolment could replace it
  await setEnrolment(app, technician, { enabled: false }).then((response) => plainAnswers.push(response.body));
  keep(await biometricSignIn(app, phone.credential, replaced)); // turned off
  keep(await biometricSignIn(app, tablet.credential, replaced)); // another device's, dead: a plain refusal
  const phoneSignedIn = await signIn('sign-in 3 (the phone)', phone.credential, await enrolIn('enrolment 4', technician));
  keep(await setEnrolment(app, phoneSignedIn.sessionToken, { enabled: true })); // a biometric session cannot enrol

  // Bodies that are refused before any attempt, each holding a token or a marker.
  keep(await app.inject({ method: 'POST', url: BIOMETRIC_SIGN_IN, headers: { authorization: `Bearer ${phone.credential}`, 'content-type': 'application/json' }, payload: `{"token":"${phoneSignedIn.biometricToken}","x":"${MARKER_JSON}` }));
  keep(await devicePost(app, BIOMETRIC_SIGN_IN, phone.credential, { token: `${MARKER_FIELD}-${'t'.repeat(300)}` }));
  keep(await devicePost(app, BIOMETRIC_FAILURE, phone.credential, { operatorId: `${MARKER_FIELD} ${phoneSignedIn.biometricToken}` }));
  keep(await devicePost(app, BIOMETRIC, technician, { enabled: phoneSignedIn.biometricToken }));

  // ── A token past its time ─────────────────────────────────────────────────────────────────
  forgetLimits(bio);
  const longAgo = await enrolIn('enrolment 5 (expires)', await session('a second password session of the investigator', tablet, INVESTIGATOR.username));
  bio.clock.advance(THIRTY_DAYS);
  forgetLimits(bio);
  keep(await biometricSignIn(app, tablet.credential, longAgo));

  // ── Failure reports, the lock, attempts during the lock ───────────────────────────────────
  for (let attempt = 0; attempt < 4; attempt += 1) await reportFailure(app, tablet.credential, attempt % 2 === 0 ? INVESTIGATOR.id : null).then((response) => plainAnswers.push(response.body));
  keep(await biometricSignIn(app, tablet.credential, longAgo));
  await reportFailure(app, tablet.credential, TECHNICIAN.id).then((response) => plainAnswers.push(response.body));

  // ── Rule M14: three statements that FAIL, each with a hash or a token row among its parameters ─
  // The runtime role loses a privilege for a moment, as the owner of this file's own clone.
  forgetLimits(bio);
  bio.clock.advance(2 * MINUTE);
  const fresh = await session('a third password session of the investigator', tablet, INVESTIGATOR.username);
  const live = await enrolIn('enrolment 6 (survives two failed units)', fresh);
  const state = async (): Promise<string> => stateOf(await tokenRow(owner, live), bio.clock.now());

  await owner.query('REVOKE UPDATE (used_at) ON public.biometric_tokens FROM dems_app');
  const failedClaim = keep(await biometricSignIn(app, tablet.credential, live)); // the claim: the hash of the token is its first parameter
  await owner.query('GRANT UPDATE (used_at) ON public.biometric_tokens TO dems_app');
  failedStatements.push(['the claim of a token', failedClaim.statusCode, await state()]);

  await owner.query('REVOKE INSERT ON public.biometric_tokens FROM dems_app');
  const failedRotation = keep(await biometricSignIn(app, tablet.credential, live)); // the insert of the next token, after the claim
  const failedEnrolment = keep(await setEnrolment(app, fresh, { enabled: true })); // the insert of a new token
  await owner.query('GRANT INSERT ON public.biometric_tokens TO dems_app');
  failedStatements.push(['the insert of the next token', failedRotation.statusCode, await state()]);
  failedStatements.push(['the insert of an enrolment', failedEnrolment.statusCode, await state()]);
  await app.db.probe({ fresh: true });
  await app.pipeline.drain();

  // What failed changed nothing: the token is as it was issued, and it signs in.
  forgetLimits(bio);
  await signIn('sign-in 4 (after the failed units)', tablet.credential, live);
  await app.pipeline.drain();
});

describe('the journey itself', () => {
  it('ran through every transition of a token: the rows it wrote, by type, and the states it left', async () => {
    const { rows } = await owner.query<{ type: string; n: string }>(
      "SELECT type, count(*) AS n FROM public.audit_log WHERE at >= $1 AND type IN ('AUTH_SUCCESS', 'AUTH_FAILED', 'AUTH_LOCKED', 'BIOMETRIC_ENROLLMENT_CHANGED') AND details ->> 'method' IS DISTINCT FROM 'PASSWORD' GROUP BY type ORDER BY type",
      [CLOCK_START],
    );
    const written = Object.fromEntries(rows.map((row) => [row.type, Number(row.n)]));
    expect(written).toEqual({ AUTH_FAILED: 12, AUTH_LOCKED: 2, AUTH_SUCCESS: 4, BIOMETRIC_ENROLLMENT_CHANGED: 7 });
    const reasons = await owner.query<{ reason: string | null; n: string }>(
      "SELECT details ->> 'reason' AS reason, count(*) AS n FROM public.audit_log WHERE at >= $1 AND type = 'AUTH_FAILED' AND details ->> 'method' = 'BIOMETRIC' GROUP BY 1 ORDER BY 1 NULLS FIRST",
      [CLOCK_START],
    );
    expect(Object.fromEntries(reasons.rows.map((row) => [String(row.reason), Number(row.n)]))).toEqual({
      null: 5,
      OTHER_DEVICE: 1,
      TOKEN_EXPIRED: 1,
      TOKEN_REUSE: 2,
      TOKEN_REVOKED: 3,
    });
    const states = (await storedTokens(owner)).map((token) => stateOf(token, bio.clock.now()));
    expect(new Set(states)).toEqual(new Set(['USED+REVOKED(TOKEN_REUSE)', 'REVOKED(TOKEN_REUSE)', 'REVOKED(REENROLLED)', 'REVOKED(DISABLED)', 'USED', 'EXPIRED', 'LIVE']));
    expect(Object.keys(issued)).toHaveLength(10);

    // The three failing statements were refused by the database, answered without a detail, and
    // each unit rolled back: the token they were about is as live as before.
    expect(failedStatements.map(([name, , state]) => [name, state])).toEqual([
      ['the claim of a token', 'LIVE'],
      ['the insert of the next token', 'LIVE'],
      ['the insert of an enrolment', 'LIVE'],
    ]);
    for (const [name, status] of failedStatements) expect([500, 503], name).toContain(status);
    console.info(
      `[w41] secret scan journey: rows ${JSON.stringify(written)}; ${Object.keys(issued).length} biometric tokens issued, ${Object.keys(others).length} session tokens and device credentials, ${Object.keys(presented).length} made-up token; failing statements answered ${failedStatements.map(([, status]) => status).join(', ')}`,
    );
  });
});

describe('the scan itself', () => {
  it('finds a token in every form it could have been written in, and leaves codes and identifiers alone (positive control)', () => {
    const token = madeUpToken('P');
    const bytes = Buffer.from(token, 'utf8');
    for (const text of [token, bytes.toString('hex'), bytes.toString('base64'), bytes.toString('base64url'), JSON.stringify({ value: token }), encodeURIComponent(token)]) {
      expect(() => expectAbsent(`before ${text} after`, { 'the planted token': token })).toThrow();
    }
    expect(credentialLeaks(`{"x":"${token}"}`)).not.toEqual([]);
    expect(credentialLeaks('{"reason":"TOKEN_REUSE","deviceId":"DEV-0001","method":"BIOMETRIC","route":"/api/v1/auth/biometric/sign-in"}')).toEqual([]);
    expect(() => expectAbsent('{"reason":"TOKEN_REUSE"}', { 'the planted token': token })).not.toThrow();
  });
});

describe('SR-36, SR-54: no audit row, event, publication or refusal of the journey holds a token', () => {
  it('the audit rows and the events of the journey', async () => {
    const { rows: audit } = await owner.query<{ line: string }>('SELECT to_jsonb(t)::text AS line FROM public.audit_log AS t WHERE at >= $1', [CLOCK_START]);
    const { rows: events } = await owner.query<{ line: string }>('SELECT to_jsonb(t)::text AS line FROM public.events AS t WHERE at >= $1', [CLOCK_START]);
    const text = [...audit, ...events].map((row) => row.line).join('\n');
    expect(audit.length).toBeGreaterThanOrEqual(30);
    expect(events.length).toBeGreaterThanOrEqual(18);
    expectAbsent(text, allSecrets());
    expect(credentialLeaks(text)).toEqual([]);
    for (const [label, secret] of Object.entries(allSecrets())) expect(occurrences(text, sha256Hex(secret)), label).toBe(0);

    // The detail keys the biometric rows use, all of them: none can name a secret, none names a family.
    const { rows: keys } = await owner.query<{ key: string }>(
      "SELECT DISTINCT jsonb_object_keys(details) AS key FROM public.audit_log WHERE at >= $1 AND (type = 'BIOMETRIC_ENROLLMENT_CHANGED' OR details ->> 'method' = 'BIOMETRIC') ORDER BY 1",
      [CLOCK_START],
    );
    expect(keys.map((row) => row.key)).toEqual(['attemptsRemaining', 'deviceId', 'enabled', 'knownOperator', 'lockedUntil', 'method', 'reason', 'retryInMs', 'sessionsEnded']);
    console.info(`[w41] rows: ${audit.length} audit rows and ${events.length} events of the journey; 0 tokens, 0 credentials, 0 hashes`);
  });

  it('the publications: a session.ended names session IDs and a reason, nothing else', () => {
    const text = JSON.stringify(bio.published);
    expectAbsent(text, allSecrets());
    expect(credentialLeaks(text)).toEqual([]);
    const ended = bio.published.filter((publication) => publication.kind === 'session.ended');
    expect(ended.map((publication) => publication.reason)).toEqual(['TOKEN_REUSE']);
    for (const publication of ended) {
      expect(Object.keys(publication).sort()).toEqual(['kind', 'reason', 'sessionIds']);
      expect(publication.sessionIds).toHaveLength(2);
      for (const id of publication.sessionIds) expect(id).toMatch(/^[0-9a-f-]{36}$/);
    }
    // E-fix FX-C (R4): a device's sign-in and the end of its session tell the channel; device IDs only.
    const devices = bio.published.filter((publication) => publication.kind === 'device.session');
    expect(devices.length).toBeGreaterThan(0);
    for (const publication of devices) {
      expect(Object.keys(publication).sort()).toEqual(['deviceIds', 'kind']);
      for (const id of publication.deviceIds) expect(id).toMatch(/^DEV-\d{4}$/);
    }
    expect([...new Set(bio.published.map((publication) => publication.kind))].sort()).toEqual(['admin.changed', 'device.session', 'session.ended']);
  });

  it('the answers of every refusal and failure: no token is echoed, no credential, no marker, nothing of a statement', () => {
    const text = refusals.join('\n');
    expect(refusals.length).toBeGreaterThanOrEqual(18);
    expectAbsent(text, { ...allSecrets(), ...markers });
    expect(credentialLeaks(text)).toEqual([]);
    expect(text).not.toMatch(/permission denied|biometric_tokens|token_hash|\$1|INSERT|UPDATE/);
    console.info(`[w41] refusals: ${refusals.length} answers of a refusal or a failure; 0 tokens, 0 credentials, 0 markers`);
  });

  it('a token is in an answer ONCE, and only in the two answers the contract names: the other answers of the folder hold none', () => {
    expect(plainAnswers.length).toBeGreaterThanOrEqual(6);
    const text = plainAnswers.join('\n');
    expect(credentialLeaks(text)).toEqual([]);
    expectAbsent(text, allSecrets());
    // No two answers handed out the same token.
    expect(new Set(Object.values(issued)).size).toBe(Object.keys(issued).length);
  });
});

describe('AC-B-28 for the biometric tokens: a full dump of the database after the journey', () => {
  it('holds no token and no credential; of each token that was issued, only the SHA-256 it is stored as, once', async () => {
    const dump = await dumpDatabase(owner);
    expect(dump.length).toBeGreaterThan(dumpBefore.length);
    expectAbsent(dump, allSecrets());
    expect(credentialLeaks(dump)).toEqual([]);

    // Not vacuous: the dump is the whole database, hash columns included.
    for (const [label, token] of Object.entries(issued)) expect(occurrences(dump, `\\\\x${sha256Hex(token)}`), label).toBe(1);
    // A value that was only presented is stored in no form.
    for (const [label, token] of Object.entries(presented)) expect(occurrences(dump, sha256Hex(token)), label).toBe(0);
    // The enrolment whose unit failed stored nothing: ten tokens issued, ten rows.
    expect(await storedTokens(owner)).toHaveLength(Object.keys(issued).length);
    console.info(
      `[w41] dump of ${db.name}: ${dump.length} characters; ${Object.keys(allSecrets()).length} tokens and credentials searched in 6 forms each: 0 found; ${Object.keys(issued).length} biometric tokens issued, ${Object.keys(issued).length} rows in biometric_tokens, each token's SHA-256 present once`,
    );
  });
});

describe('AC-B-29: the log of the same journey, captured at level trace', () => {
  it('holds no token, no credential, no marker and no hash of a token', () => {
    const text = bio.log.text();
    expectAbsent(text, { ...allSecrets(), ...markers });
    expect(credentialLeaks(text)).toEqual([]);
    for (const [label, secret] of Object.entries(allSecrets())) expect(occurrences(text, sha256Hex(secret)), label).toBe(0);
    // Not vacuous: the journey is in it.
    const completed = bio.log.lines().filter((line) => line['msg'] === 'request completed');
    expect(completed.length).toBeGreaterThanOrEqual(40);
    console.info(`[w41] AC-B-29 log capture: ${text.length} characters, ${bio.log.lines().length} lines, ${completed.length} request lines; 0 tokens, 0 credentials, 0 markers, 0 hashes`);
  });

  it('rule M14: the three failing statements are in the log as errors with their code, and nothing of a statement, a parameter or a hash', () => {
    const failures = bio.log.lines().filter((line) => Number(line['level']) >= 50);
    expect(failures.length).toBeGreaterThanOrEqual(3);
    expect(failures.filter((line) => JSON.stringify(line).includes('42501')).length).toBeGreaterThanOrEqual(3);
    // An error is logged under `err` and under no other key.
    for (const line of failures) {
      for (const key of ['error', 'cause', 'e', 'reason', 'query', 'params', 'parameters', 'detail']) expect(key in line, key).toBe(false);
    }
    const text = bio.log.text();
    expect(text).not.toMatch(/permission denied|UPDATE public|INSERT INTO|SELECT |token_hash|family_id|\$1/);
    expect(text).not.toMatch(/[0-9a-f]{64}/);
  });

  it('no request line holds a query string: the route is the registry\'s pattern', () => {
    const routes = bio.log
      .lines()
      .filter((line) => line['msg'] === 'request completed')
      .map((line) => String(line['route']));
    expect(routes.filter((route) => route.includes('?') || route.includes('='))).toEqual([]);
    const own = new Set(routes.filter((route) => route.startsWith(BIOMETRIC)));
    expect([...own].sort()).toEqual(['/api/v1/auth/biometric', '/api/v1/auth/biometric/failure', '/api/v1/auth/biometric/sign-in']);
    expect(bio.log.text().includes('token=')).toBe(false);
    expect(bio.log.text().includes('bio=')).toBe(false);
  });

  it('a parse or validation failure of the three operations is logged by its code only', () => {
    const failures = bio.log
      .lines()
      .filter((line) => line['msg'] === 'request completed' && String(line['route']).startsWith(BIOMETRIC) && [400, 422].includes(Number(line['status'])));
    expect(failures.map((line) => line['code']).sort()).toEqual(['INVALID_INPUT', 'INVALID_INPUT', 'INVALID_INPUT', 'INVALID_INPUT', 'INVALID_JSON']);
    for (const line of failures) expect(Object.keys(line).sort()).toEqual(['code', 'durationMs', 'hostname', 'level', 'method', 'msg', 'pid', 'principal', 'reqId', 'route', 'status', 'time']);
  });

  it('the principal of a request line is an operator ID or a device ID, never a credential; the request line of a sign-in names the device, not the operator the token signed in', () => {
    const lines = bio.log.lines().filter((line) => line['msg'] === 'request completed' && String(line['route']).startsWith(BIOMETRIC));
    for (const line of lines) {
      const principal = line['principal'];
      expect(principal === null || /^(operator:OPR-\d{3}|device:DEV-\d{4})$/.test(String(principal))).toBe(true);
    }
    const signIns = lines.filter((line) => line['route'] === BIOMETRIC_SIGN_IN && line['status'] === 200);
    expect(signIns.length).toBe(4);
    for (const line of signIns) expect(String(line['principal'])).toMatch(/^device:DEV-\d{4}$/);
  });
});
