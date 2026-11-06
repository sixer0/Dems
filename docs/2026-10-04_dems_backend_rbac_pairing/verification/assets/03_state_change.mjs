#!/usr/bin/env node
// Asset of plan row W90 (verification/03_clean_state_rebuild.md): changes state through the API
// of the Core server on 127.0.0.1:4420 — one sign-in of the Supervisor from the web console
// origin, one read of the session, one sign-out (a harmless command: audit AUTH_SIGNED_OUT).
//
// The seeded password comes from the shared constant DEMO_OPERATOR_PASSWORD by import and is
// never printed; a cookie value is never printed (name and length only).
// Run from the repository root: node --import tsx <this file>
import { DEMO_OPERATOR_PASSWORD, OPERATORS } from '../../../../packages/shared/src/sim/dataset.ts';

const API = 'http://127.0.0.1:4420/api/v1';
const ORIGIN = 'http://127.0.0.1:5173';
const supervisor = OPERATORS.find((o) => o.role === 'SUPERVISOR');
if (!supervisor) throw new Error('no SUPERVISOR in the shared dataset');

let failures = 0;
const step = (name, pass, detail) => {
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name} | ${detail}`);
};
const payload = (body) => body?.data ?? body;

const signIn = await fetch(`${API}/auth/sign-in`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: ORIGIN },
  body: JSON.stringify({ username: supervisor.username, password: DEMO_OPERATOR_PASSWORD }),
});
const signInBody = await signIn.json();
const raw = signIn.headers.get('set-cookie') ?? '';
const [pair] = raw.split(';');
const [cookieName, cookieValue = ''] = pair.split('=');
step(
  'POST /auth/sign-in (SUPERVISOR, origin 127.0.0.1:5173)',
  signIn.status === 200 && cookieValue.length > 0,
  `status=${signIn.status} operator=${payload(signInBody)?.operator?.id ?? 'n/a'} role=${payload(signInBody)?.operator?.role ?? 'n/a'} cookie=${cookieName} (${cookieValue.length} chars, value not printed)`,
);
const cookie = `${cookieName}=${cookieValue}`;

const session = await fetch(`${API}/auth/session`, { headers: { cookie, origin: ORIGIN } });
const sessionBody = await session.json();
step('GET /auth/session', session.status === 200, `status=${session.status} role=${payload(sessionBody)?.operator?.role ?? 'n/a'}`);

const signOut = await fetch(`${API}/auth/sign-out`, {
  method: 'POST',
  headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' },
  body: '{}',
});
step('POST /auth/sign-out', signOut.status === 200 || signOut.status === 204, `status=${signOut.status}`);

const after = await fetch(`${API}/auth/session`, { headers: { cookie, origin: ORIGIN } });
step('GET /auth/session after sign-out is refused', after.status === 401, `status=${after.status}`);

console.log(failures === 0 ? 'state change: OK' : `state change: ${failures} step(s) FAILED`);
process.exit(failures === 0 ? 0 : 1);
