// AC-B-29 (pairing flow) and AC-B-41: after a whole pairing lifecycle, no audit row, no event,
// no publication, no error answer, no line of the log captured at level `trace` and no row of a
// full dump of the database holds a pairing code or a device credential (plan row W32; spec
// SR-28, SR-31, SR-48, SR-49, SR-54; database contract §5.4 NL-1 to NL-3, §5.5; rule M14).
//
// The values searched for are held by the test only. A failure names a secret by its label and
// the form it was found in, never by its value; this file prints counts and nothing else (P19).
import { createHash } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { dumpDatabase } from '../../../../test/support/seed';
import { credentialLeaks } from '../../../../test/support/config';
import { CLOCK_START, MINUTE, SESSION, deviceSignIn, expectAbsent, get, occurrences, type Headers } from '../../../../test/support/identity';
import {
  CODE,
  CODE_CANCEL,
  DEVICE,
  DEVICES,
  INVESTIGATOR,
  REDEEM,
  ROTATE,
  TABLET,
  UNPAIR,
  deviceGet,
  devicePost,
  forgetLimits,
  issueCode,
  pairingApp,
  portalPost,
  redeem,
  revokeUrl,
  supervisorCookie,
  wrongCodeFor,
  type PairingApp,
} from '../../../../test/support/pairing';

const db = useTestDatabase({ template: 'seed' });
let pairing: PairingApp;
let owner: Pool;
let dumpBefore = '';

/** Markers: made-up values that must leave no trace in a log line. */
const MARKER_QUERY = 'W32-MARKER-query-5c1f0a';
const MARKER_JSON = 'W32-MARKER-json-9be274';
const MARKER_FIELD = 'W32-MARKER-field-31d6ac';

/** Everything of the journey that must be in no row, no publication, no answer of a refusal and no log line, by label. */
const codes: Record<string, string> = {};
const codeIds: Record<string, string> = {};
const credentials: Record<string, string> = {};
const markers: Record<string, string> = { 'the query marker': MARKER_QUERY, 'the malformed-JSON marker': MARKER_JSON, 'the refused-field marker': MARKER_FIELD };
/** The bodies of every answer that was a refusal or a failure. */
const refusals: string[] = [];
const failedStatements: Array<[string, number]> = [];

/**
 * How often six digits occur as a value of their own: not inside a longer run of digits or
 * hexadecimal digits (a timestamp, a hash), not as decimals, and not as the number of an
 * identifier (`PCD-000007`).
 */
function codeOccurrences(text: string, code: string): number {
  return [...text.matchAll(new RegExp(`(?<![0-9a-fA-F.-])${code}(?![0-9a-fA-F])`, 'g'))].length;
}

/** The forms a code could have been written in; a failure names the label and the form. */
function codeLeaks(text: string, baseline = ''): string[] {
  const found: string[] = [];
  for (const [label, code] of Object.entries(codes)) {
    if (codeOccurrences(text, code) > codeOccurrences(baseline, code)) found.push(`${label} as digits`);
    const bytes = Buffer.from(code, 'utf8');
    for (const [form, value] of Object.entries({ hex: bytes.toString('hex'), base64: bytes.toString('base64'), base64url: bytes.toString('base64url') })) {
      if (occurrences(text, value) > occurrences(baseline, value)) found.push(`${label} as ${form}`);
    }
  }
  return found;
}

const sha256Hex = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
const keep = (response: LightMyRequestResponse): LightMyRequestResponse => {
  if (response.statusCode >= 400) refusals.push(response.body);
  return response;
};

beforeAll(async () => {
  owner = db.ownerPool();
  pairing = await pairingApp(db, { logLevel: 'trace' });
  dumpBefore = await dumpDatabase(owner);
  const { app } = pairing;
  let cookie: Headers = await supervisorCookie(pairing);
  const rememberCode = (label: string, issued: { codeId: string; code: string }): string => {
    codes[label] = issued.code;
    codeIds[label] = issued.codeId;
    return issued.code;
  };
  const rememberCredential = (label: string, response: LightMyRequestResponse): string => {
    const body = response.json() as { deviceCredential?: string };
    if (typeof body.deviceCredential !== 'string' || !/^dvc_[A-Za-z0-9_-]{43}$/.test(body.deviceCredential)) throw new Error(`${label}: no device credential was issued`);
    credentials[label] = body.deviceCredential;
    return body.deviceCredential;
  };

  // ── A code, read with a query string that holds it; wrong guesses; the lock ───────────────
  const first = rememberCode('code 1', await issueCode(pairing, cookie));
  codes['wrong guess 1'] = wrongCodeFor(first);
  codes['wrong guess 2'] = wrongCodeFor(codes['wrong guess 1']);
  await get(app, `${CODE}?code=${first}&token=${MARKER_QUERY}`, cookie);
  await get(app, `${DEVICES}?qr=DEMS-PAIR:1:${first}&token=${MARKER_QUERY}`, cookie);
  keep(await redeem(app, codes['wrong guess 1']));
  keep(await redeem(app, codes['wrong guess 2']));
  keep(await redeem(app, codes['wrong guess 1'])); // the locking failure
  keep(await redeem(app, first)); // the right code during the lock: not compared, not logged

  // Bodies that are refused before any attempt, each holding the code: malformed JSON, a field
  // that does not validate, a text with a credential form, a query string on the POST.
  keep(await app.inject({ method: 'POST', url: REDEEM, headers: { 'content-type': 'application/json' }, payload: `{"code":"${first}","deviceName":"${MARKER_JSON}` }));
  keep(await devicePost(app, REDEEM, null, { code: first, ...TABLET, platform: `${MARKER_FIELD}-${'p'.repeat(40)}` }));
  keep(await devicePost(app, REDEEM, null, { code: first, ...TABLET, deviceName: `${MARKER_FIELD} ${first}` }));
  keep(await devicePost(app, `${REDEEM}?code=${first}&token=${MARKER_QUERY}`, null, { code: 'nope', ...TABLET }));

  // ── After the lock: the device is paired; its credential in a query string authenticates nothing ─
  pairing.clock.advance(MINUTE);
  forgetLimits(pairing);
  const one = rememberCredential('credential 1', await redeem(app, first));
  keep(await redeem(app, first)); // used
  keep(await deviceGet(app, `${DEVICE}?credential=${one}&token=${MARKER_QUERY}`, null));
  await deviceGet(app, `${DEVICE}?token=${MARKER_QUERY}`, one);
  const session = ((await deviceSignIn(app, one, INVESTIGATOR.username)).json() as { sessionToken: string }).sessionToken;
  credentials['device session token'] = session;
  await deviceGet(app, SESSION, session);

  // ── Rotation in both phases, and a rotation whose credential is never used ────────────────
  const two = rememberCredential('credential 1, rotated', await devicePost(app, ROTATE, one));
  await deviceGet(app, DEVICE, one);
  await deviceGet(app, DEVICE, two); // the first use: promoted
  keep(await deviceGet(app, DEVICE, one)); // rotated out
  const pending = rememberCredential('credential 1, pending', await devicePost(app, ROTATE, two));

  // ── Cancel, expiry, exhaustion ─────────────────────────────────────────────────────────────
  forgetLimits(pairing);
  rememberCode('code 2 (cancelled)', await issueCode(pairing, cookie));
  await portalPost(app, CODE_CANCEL, cookie);
  keep(await redeem(app, codes['code 2 (cancelled)'] ?? ''));
  const third = rememberCode('code 3 (expired)', await issueCode(pairing, cookie));
  pairing.clock.advance(5 * MINUTE);
  await pairing.pairing.sweepCodes();
  forgetLimits(pairing);
  keep(await redeem(app, third));
  const fourth = rememberCode('code 4 (exhausted)', await issueCode(pairing, cookie));
  codes['wrong guess 3'] = wrongCodeFor(fourth);
  forgetLimits(pairing);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt === 3) {
      pairing.clock.advance(MINUTE);
      forgetLimits(pairing);
    }
    keep(await redeem(app, codes['wrong guess 3']));
  }
  keep(await redeem(app, fourth));

  // ── A second device, unpaired by itself; the first one revoked; calls of both afterwards ──
  pairing.clock.advance(MINUTE);
  forgetLimits(pairing);
  cookie = await supervisorCookie(pairing);
  const fifth = rememberCode('code 5', await issueCode(pairing, cookie));
  const other = rememberCredential('credential 2', await redeem(app, fifth, { deviceName: 'Second tablet' }));
  await devicePost(app, UNPAIR, other);
  keep(await deviceGet(app, DEVICE, other));

  // ── Rule M14: two statements that FAIL, each with a hash among its parameters ─────────────
  // The runtime role loses a privilege for a moment, as the owner of this file's own clone.
  await owner.query('REVOKE SELECT ON public.device_credentials FROM dems_app');
  const failedRead = keep(await deviceGet(app, DEVICE, two)); // the resolver's lookup by the credential's hash
  await owner.query('GRANT SELECT ON public.device_credentials TO dems_app');
  failedStatements.push(['the lookup of a credential', failedRead.statusCode]);
  await owner.query('REVOKE UPDATE (next_hash, rotated_at) ON public.device_credentials FROM dems_app');
  const failedUnit = keep(await devicePost(app, ROTATE, two)); // the statement that stores the hash of a new credential
  await owner.query('GRANT UPDATE (next_hash, rotated_at) ON public.device_credentials TO dems_app');
  failedStatements.push(['the unit of a rotation', failedUnit.statusCode]);
  await app.db.probe({ fresh: true });
  await app.pipeline.drain();

  keep(await portalPost(app, revokeUrl('DEV-0001'), cookie, { reason: 'no' }));
  await portalPost(app, revokeUrl('DEV-0001'), cookie, { reason: 'Revoked at the end of the lifecycle' });
  keep(await deviceGet(app, DEVICE, two));
  keep(await deviceGet(app, DEVICE, pending));
  keep(await deviceGet(app, SESSION, session));
  await app.pipeline.drain();
});

describe('the journey itself', () => {
  it('ran through every transition of spec §6.2 and §6.3: the rows it wrote, by type', async () => {
    const { rows } = await owner.query<{ type: string; n: string }>(
      "SELECT type, count(*) AS n FROM public.audit_log WHERE at >= $1 AND (category = 'PAIRING' OR type = 'ACCESS_DENIED') GROUP BY type ORDER BY type",
      [CLOCK_START],
    );
    const written = Object.fromEntries(rows.map((row) => [row.type, Number(row.n)]));
    expect(written).toEqual({
      ACCESS_DENIED: 4,
      DEVICE_CREDENTIAL_ROTATED: 2,
      DEVICE_REVOKED: 1,
      PAIRING_CODE_CLOSED: 3,
      PAIRING_CODE_ISSUED: 5,
      PAIRING_FAILED: 12,
      PAIRING_LOCKED: 1,
      PAIRING_SUCCESS: 2,
      UNPAIRED: 1,
    });
    expect(Object.keys(codes)).toHaveLength(8);
    expect(Object.keys(credentials)).toHaveLength(5);
    // The two failing statements were refused by the database and answered without a detail.
    expect(failedStatements.map(([name]) => name)).toEqual(['the lookup of a credential', 'the unit of a rotation']);
    for (const [name, status] of failedStatements) expect([500, 503], name).toContain(status);
    console.info(`[w32] secret scan journey: rows ${JSON.stringify(written)}; ${Object.keys(codes).length} codes and guesses, ${Object.keys(credentials).length} credentials and tokens; failing statements answered ${failedStatements.map(([, status]) => status).join(', ')}`);
  });

  it('the scan for a code finds one in every form it could be written in, and leaves identifiers, timestamps and hashes alone (positive control)', () => {
    const code = '042195';
    for (const text of [`{"code":"${code}"}`, `code ${code} was typed`, `DEMS-PAIR:1:${code}`, `PCD-000007:${code}`, `?code=${code}&x=1`, `["${code}"]`, `attempt=${code}`]) {
      expect(codeOccurrences(text, code), text.replace(code, '<code>')).toBe(1);
    }
    for (const text of [`PCD-${code}`, `19250${code}00`, `a${code}`, `${code}f`, `1.${code}`, `"hash":"\\\\x${'0'.repeat(20)}${code}${'e'.repeat(38)}"`]) {
      expect(codeOccurrences(text, code), text.replace(code, '<code>')).toBe(0);
    }
  });
});

describe('AC-B-41: no audit row, event, publication or refusal of the whole lifecycle holds a code or a credential', () => {
  it('the audit rows and the events of the journey', async () => {
    const { rows: audit } = await owner.query<{ line: string }>('SELECT to_jsonb(t)::text AS line FROM public.audit_log AS t WHERE at >= $1', [CLOCK_START]);
    const { rows: events } = await owner.query<{ line: string }>('SELECT to_jsonb(t)::text AS line FROM public.events AS t WHERE at >= $1', [CLOCK_START]);
    const text = [...audit, ...events].map((row) => row.line).join('\n');
    expect(audit.length).toBeGreaterThanOrEqual(30);
    expect(events.length).toBeGreaterThanOrEqual(15);
    expect(codeLeaks(text)).toEqual([]);
    expectAbsent(text, credentials);
    expect(credentialLeaks(text)).toEqual([]);
    expect(text).not.toMatch(/DEMS-PAIR/);

    // The detail keys the pairing rows use, all of them: none can name a secret.
    const { rows: keys } = await owner.query<{ key: string }>(
      "SELECT DISTINCT jsonb_object_keys(details) AS key FROM public.audit_log WHERE category = 'PAIRING' AND at >= $1 ORDER BY 1",
      [CLOCK_START],
    );
    expect(keys.map((row) => row.key)).toEqual(['attemptsRemaining', 'certificateFingerprint', 'codeId', 'coreDeviceId', 'expiresAt', 'lockedUntil', 'reason', 'retryInMs', 'sessionsEnded']);
    console.info(`[w32] AC-B-41 rows: ${audit.length} audit rows and ${events.length} events of the journey; 0 codes, 0 credentials`);
  });

  it('the publications: what the realtime channel is handed names kinds, resources and device IDs only', () => {
    const text = JSON.stringify(pairing.published);
    expect(pairing.published.length).toBeGreaterThanOrEqual(15);
    expect(codeLeaks(text)).toEqual([]);
    expectAbsent(text, credentials);
    const kinds = new Set(pairing.published.map((publication) => publication.kind));
    // `device.session` (E-fix FX-C, R4): a device's sign-in or the end of its session, by device ID only.
    expect([...kinds].sort()).toEqual(['admin.changed', 'device.revoked', 'device.session']);
    const keysOf: Record<string, string[]> = {
      'device.revoked': ['deviceId', 'kind', 'reason'],
      'device.session': ['deviceIds', 'kind'],
      'admin.changed': ['kind', 'resource'],
    };
    for (const publication of pairing.published) {
      expect(Object.keys(publication).sort()).toEqual(keysOf[publication.kind]);
    }
  });

  it('the answers of every refusal and failure: no code is echoed, no credential, no marker', () => {
    const text = refusals.join('\n');
    expect(refusals.length).toBeGreaterThanOrEqual(20);
    expect(codeLeaks(text)).toEqual([]);
    expectAbsent(text, { ...credentials, ...markers });
    expect(text).not.toMatch(/permission denied|device_credentials|next_hash|\$1/);
    console.info(`[w32] AC-B-41 refusals: ${refusals.length} answers of a refusal or a failure; 0 codes, 0 credentials, 0 markers`);
  });
});

describe('SR-28, SR-31 (AC-B-28 for the pairing tables): a full dump of the database after the lifecycle', () => {
  it('holds no code and no credential; of each, only the hash it is stored as', async () => {
    const dump = await dumpDatabase(owner);
    expect(dump.length).toBeGreaterThan(dumpBefore.length);
    // Six digits may stand in the seed's own data by chance: what counts is what the journey added.
    expect(codeLeaks(dump, dumpBefore)).toEqual([]);
    expectAbsent(dump, credentials);
    expect(dump).not.toMatch(/DEMS-PAIR/);

    // Not vacuous: the dump is the whole database, hash columns included.
    for (const [label, code] of Object.entries(codes)) {
      const codeId = codeIds[label];
      if (codeId === undefined) continue; // a wrong guess: it was never stored in any form
      expect(occurrences(dump, `\\\\x${sha256Hex(`${codeId}:${code}`)}`), label).toBe(1);
    }
    for (const label of Object.keys(codes).filter((candidate) => codeIds[candidate] === undefined)) {
      for (const codeId of Object.values(codeIds)) expect(occurrences(dump, sha256Hex(`${codeId}:${codes[label] ?? ''}`)), label).toBe(0);
    }
    // The current credential of each device and the pending one are there as hashes; the one that was rotated out is gone.
    const stored = (label: string): number => occurrences(dump, `\\\\x${sha256Hex(credentials[label] ?? '')}`);
    expect([stored('credential 1'), stored('credential 1, rotated'), stored('credential 1, pending'), stored('credential 2')]).toEqual([0, 1, 1, 1]);
    console.info(`[w32] dump of ${db.name}: ${dump.length} characters; ${Object.keys(codes).length} codes and guesses in 4 forms, ${Object.keys(credentials).length} credentials and tokens in 6 forms: 0 found; 5 code hashes and 3 credential hashes present once each`);
  });
});

describe('AC-B-29: the log of the same lifecycle, captured at level trace', () => {
  it('holds no code, no credential, no marker and no hash of either', () => {
    const text = pairing.log.text();
    expect(codeLeaks(text)).toEqual([]);
    expectAbsent(text, { ...credentials, ...markers });
    expect(credentialLeaks(text)).toEqual([]);
    expect(text).not.toMatch(/DEMS-PAIR/);
    for (const [label, code] of Object.entries(codes)) {
      for (const codeId of Object.values(codeIds)) expect(occurrences(text, sha256Hex(`${codeId}:${code}`)), label).toBe(0);
    }
    for (const [label, credential] of Object.entries(credentials)) expect(occurrences(text, sha256Hex(credential)), label).toBe(0);
    // Not vacuous: the lifecycle is in it.
    const completed = pairing.log.lines().filter((line) => line['msg'] === 'request completed');
    expect(completed.length).toBeGreaterThanOrEqual(45);
    console.info(`[w32] AC-B-29 log capture: ${text.length} characters, ${pairing.log.lines().length} lines, ${completed.length} request lines; 0 codes, 0 credentials, 0 markers, 0 hashes`);
  });

  it('rule M14: the two failing statements are in the log as an error with its code, and nothing of a statement, a parameter or a hash', () => {
    const lines = pairing.log.lines();
    const failures = lines.filter((line) => Number(line['level']) >= 50);
    expect(failures.length).toBeGreaterThanOrEqual(2);
    const read = failures.find((line) => line['msg'] === 'a read on the pool failed');
    expect(read).toMatchObject({ source: 'pairing.resolveCredential', err: { code: '42501', message: '42501' } });
    expect(Object.keys(read ?? {}).sort()).toEqual(['err', 'hostname', 'level', 'msg', 'pid', 'source', 'time']);
    // Whatever wrote a line for the failed unit: it names the SQLSTATE, and no line of the log
    // quotes a statement, a bound value or a run of 64 hexadecimal digits.
    expect(failures.some((line) => JSON.stringify(line).includes('42501') && line !== read)).toBe(true);
    const text = pairing.log.text();
    expect(text).not.toMatch(/permission denied|UPDATE public|SELECT c\.device_id|next_hash|current_hash|code_hash/);
    expect(text).not.toMatch(/[0-9a-f]{64}/);
  });

  it('no request line holds a query string: the route is the registry\'s pattern', () => {
    const routes = pairing.log
      .lines()
      .filter((line) => line['msg'] === 'request completed')
      .map((line) => String(line['route']));
    expect(routes.filter((route) => route.includes('?') || route.includes('='))).toEqual([]);
    const own = new Set(routes.filter((route) => route.startsWith('/api/v1/pairing')));
    expect([...own].sort()).toEqual([
      '/api/v1/pairing/code',
      '/api/v1/pairing/code/cancel',
      '/api/v1/pairing/device',
      '/api/v1/pairing/device/credential',
      '/api/v1/pairing/device/unpair',
      '/api/v1/pairing/devices',
      '/api/v1/pairing/devices/:id/revoke',
      '/api/v1/pairing/redeem',
    ]);
    expect(pairing.log.text().includes('token=')).toBe(false);
  });

  it('a parse or validation failure of the redeem is logged by its code only', () => {
    const failures = pairing.log
      .lines()
      .filter((line) => line['msg'] === 'request completed' && line['route'] === REDEEM && [400, 422].includes(Number(line['status'])));
    expect(failures.map((line) => line['code']).sort()).toEqual(['INVALID_INPUT', 'INVALID_INPUT', 'INVALID_INPUT', 'INVALID_JSON']);
    for (const line of failures) expect(Object.keys(line).sort()).toEqual(['code', 'durationMs', 'hostname', 'level', 'method', 'msg', 'pid', 'principal', 'reqId', 'route', 'status', 'time']);
  });

  it('the principal of a request line is an operator ID or a device ID, never a credential', () => {
    const principals = new Set(pairing.log.lines().filter((line) => line['msg'] === 'request completed').map((line) => line['principal']));
    for (const principal of principals) {
      expect(principal === null || /^(operator:OPR-\d{3}|device:DEV-\d{4})$/.test(String(principal))).toBe(true);
    }
    expect(principals.has('device:DEV-0001')).toBe(true);
  });
});
