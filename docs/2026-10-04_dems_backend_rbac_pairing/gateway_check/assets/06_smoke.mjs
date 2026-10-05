#!/usr/bin/env node
/**
 * Asset of plan row W58 (gateway_check/06_backend_gate.md) — items D, E and the log probes of G.
 *
 * Read-only on the code: it starts nothing and writes nothing to the repository. It talks to a
 * Core server that the shell script 06_smoke_run.sh has started under the P18 lock on port 4420
 * with `dems_demo`, and it reads `dems_demo` with the runtime role (`dems_app`, SELECT only on
 * `audit_log`).
 *
 * Nothing secret is printed: a cookie or token value is never printed (name, length and
 * attributes only), the seeded password comes from the shared constant DEMO_OPERATOR_PASSWORD and
 * is never echoed, and an audit row is printed by sequence, type, actor, message and its allowed
 * detail keys only.
 *
 * Run from /Users/gsp-budi/Documents/DEMS:
 *   node --import tsx docs/.../gateway_check/assets/06_smoke.mjs
 */
import { readFileSync } from 'node:fs';
import pg from 'pg';
import WebSocket from 'ws';
import { DEMO_OPERATOR_PASSWORD, OPERATORS } from '/Users/gsp-budi/Documents/DEMS/packages/shared/src/sim/dataset.ts';

const ROOT = '/Users/gsp-budi/Documents/DEMS';
const BASE = 'http://127.0.0.1:4420';
const API = `${BASE}/api/v1`;
const WEB_ORIGIN = 'http://127.0.0.1:5173';
const MARKER = 'w58-log-probe-marker-4c17';

const byRole = (role) => OPERATORS.find((operator) => operator.role === role);
const SUPERVISOR = byRole('SUPERVISOR');
const INVESTIGATOR = byRole('INVESTIGATOR');
if (!SUPERVISOR || !INVESTIGATOR) throw new Error('the seeded operators are not in the shared dataset');

// ── Connection of the read-only audit check (values never printed) ─────────────────────────────

const values = {};
for (const line of readFileSync(`${ROOT}/.data/pg.env`, 'utf8').split('\n')) {
  const at = line.indexOf('=');
  if (at > 0) values[line.slice(0, at).trim()] = line.slice(at + 1).trim();
}
const pool = new pg.Pool({
  host: values.DEMS_PG_HOST,
  port: Number(values.DEMS_PG_PORT),
  database: values.DEMS_PG_DATABASE,
  user: values.DEMS_PG_APP_ROLE,
  password: values.DEMS_PG_APP_PASSWORD,
  max: 1,
  application_name: 'dems-w58-smoke',
});

const /** @returns {Promise<number>} */ lastDenialSeq = async () =>
  (await pool.query(`select coalesce(max(seq), 0) as seq from audit_log where type = 'ACCESS_DENIED'`)).rows[0].seq;

const /** @returns {Promise<any[]>} */ denialRows = async (sinceSeq) =>
  (
    await pool.query(
      `select seq, type, actor_id, message, details from audit_log where type = 'ACCESS_DENIED' and seq > $1 order by seq`,
      [sinceSeq],
    )
  ).rows;

const newRowsSince = async (sinceSeq) =>
  (await pool.query(`select seq, type, actor_id from audit_log where seq > $1 order by seq`, [sinceSeq])).rows;

// ── Step printing ──────────────────────────────────────────────────────────────────────────────

let failures = 0;
function step(name, pass, detail) {
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name} | ${detail}`);
}

/** The answer envelope: `status` plus the payload members next to it (spec §7.1, API-1). */
const payloadOf = (body) => body?.data ?? body;

/** The cookie an answer sets: the pair to send back, and a description that holds no value. */
function cookieOf(response) {
  const raw = response.headers.get('set-cookie');
  if (!raw) return null;
  const [first] = raw.split(', ');
  const [pair, ...attributes] = first.split(';');
  const [name, value = ''] = pair.split('=');
  return { send: `${name}=${value}`, name, length: value.length, attributes: attributes.map((part) => part.trim()) };
}

const head = (extra) => ({ 'content-type': 'application/json', ...extra });

const startSeq = Number((await pool.query(`select coalesce(max(seq),0)::int as seq from audit_log`)).rows[0].seq);

// ── 1. Health ──────────────────────────────────────────────────────────────────────────────────

{
  const response = await fetch(`${API}/health`);
  const body = await response.json();
  const health = payloadOf(body);
  step(
    'health',
    response.status === 200 && health?.service === 'dems-core-server' && health?.ready?.database === true && health?.ready?.engine === true,
    `status=${response.status} envelope_keys=[${Object.keys(body).join(', ')}] service=${health?.service} version=${health?.version} ready=${JSON.stringify(health?.ready)} ws=${JSON.stringify(health?.ws)}`,
  );
}

// ── 2. Sign-in of the SUPERVISOR (web console origin, cookie) ──────────────────────────────────

let supervisorCookie = null;
{
  const response = await fetch(`${API}/auth/sign-in`, {
    method: 'POST',
    headers: head({ origin: WEB_ORIGIN }),
    body: JSON.stringify({ username: SUPERVISOR.username, password: DEMO_OPERATOR_PASSWORD }),
  });
  const body = await response.json();
  const result = payloadOf(body);
  const cookie = cookieOf(response);
  supervisorCookie = cookie?.send ?? null;
  step(
    'sign-in SUPERVISOR (web console origin, cookie)',
    response.status === 200 && cookie !== null,
    `status=${response.status} operator_role=${result?.operator?.role ?? 'n/a'} cookie=${cookie ? `${cookie.name} (${cookie.length} chars) attributes=${JSON.stringify(cookie.attributes)}` : 'none'} set_cookie_shows_value=no`,
  );
}

// ── 3. One protected call (listUsers needs USER_ADMIN) ─────────────────────────────────────────

{
  const response = await fetch(`${API}/admin/users`, { headers: { origin: WEB_ORIGIN, cookie: supervisorCookie ?? '' } });
  const body = await response.json();
  const users = payloadOf(body)?.users ?? [];
  step(
    'protected call listUsers as SUPERVISOR (holds USER_ADMIN)',
    response.status === 200 && users.length > 0,
    `status=${response.status} users=${users.length} roles=${users.map((user) => user.role).join('/')}`,
  );
}

// ── 4. One denied call, with exactly one ACCESS_DENIED row ─────────────────────────────────────

{
  const before = await lastDenialSeq();
  const signedIn = await fetch(`${API}/auth/sign-in`, {
    method: 'POST',
    headers: head({ origin: WEB_ORIGIN }),
    body: JSON.stringify({ username: INVESTIGATOR.username, password: DEMO_OPERATOR_PASSWORD }),
  });
  const investigatorCookie = cookieOf(signedIn);
  const denied = await fetch(`${API}/admin/users`, {
    headers: { origin: WEB_ORIGIN, cookie: investigatorCookie?.send ?? '' },
  });
  const deniedBody = await denied.json().catch(() => null);
  const code = payloadOf(deniedBody)?.code ?? deniedBody?.code ?? deniedBody?.error?.code ?? (deniedBody?.status ?? 'n/a');
  const rows = await denialRows(before);
  const one = rows.length === 1;
  const row = rows[0];
  step(
    'denied call listUsers as INVESTIGATOR answers 403',
    signedIn.status === 200 && denied.status === 403,
    `sign-in status=${signedIn.status}; denied status=${denied.status} code=${code}`,
  );
  step(
    'exactly one ACCESS_DENIED audit row for that call',
    one && row?.type === 'ACCESS_DENIED' && String(row?.message ?? '').includes('listUsers') && row?.details?.permission === 'USER_ADMIN',
    one
      ? `seq=${row.seq} type=${row.type} actor=${row.actor_id} message="${row.message}" details=${JSON.stringify(row.details)}`
      : `${rows.length} ACCESS_DENIED rows with seq > ${before}`,
  );
}

// ── 5. The socket heartbeat ────────────────────────────────────────────────────────────────────

{
  const seen = [];
  const socket = new WebSocket('ws://127.0.0.1:4420/ws', {
    headers: { cookie: supervisorCookie ?? '', origin: WEB_ORIGIN },
  });
  const verdict = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timed out after 6 s'), 6_000);
    socket.on('message', (data) => {
      seen.push(JSON.parse(String(data)));
      if (seen.some((m) => m.type === 'hello') && seen.some((m) => m.type === 'heartbeat')) {
        clearTimeout(timer);
        resolve('both received');
      }
    });
    socket.on('error', (error) => {
      clearTimeout(timer);
      resolve(`error: ${error.name}`);
    });
    socket.on('close', (code) => resolve(`closed ${code} before both messages`));
  });
  const hello = seen.find((m) => m.type === 'hello');
  const beat = seen.find((m) => m.type === 'heartbeat');
  step(
    'socket heartbeat on /ws (cookie of the web session)',
    hello !== undefined && beat !== undefined,
    `verdict=${verdict} types=[${seen.map((m) => m.type).join(', ')}] hello={epoch:${hello?.epoch},revision:${hello?.revision},roles:${JSON.stringify(hello?.roles ?? null)}} heartbeat={state:${beat?.state},epoch:${beat?.epoch},uptimeMs:${beat?.uptimeMs !== undefined ? 'present' : 'absent'}}`,
  );
  socket.close(1000, 'w58 done');
}

// ── 6. Log probes: a query string and a malformed body, both holding a marker ──────────────────

{
  const withQuery = await fetch(`${API}/health?token=${MARKER}`);
  const malformed = await fetch(`${API}/auth/sign-in`, {
    method: 'POST',
    headers: head({ origin: WEB_ORIGIN, cookie: supervisorCookie ?? '' }),
    body: `{"username":"${MARKER}" not json at all {`,
  });
  step(
    'log probes sent (a ?token= query and a malformed body, both holding the marker)',
    withQuery.status === 200 && malformed.status >= 400 && malformed.status < 500,
    `health with a query string status=${withQuery.status}; malformed sign-in status=${malformed.status}`,
  );
}

const added = await newRowsSince(startSeq);
console.log(`AUDIT_SINCE_START count=${added.length} seqs=[${added.map((r) => `${r.seq}:${r.type}`).join(', ')}]`);
await pool.end();
console.log(`SMOKE_SUMMARY failures=${failures}`);
process.exit(failures === 0 ? 0 : 1);
