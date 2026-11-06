#!/usr/bin/env node
/**
 * Asset of plan row W58 (gateway_check/06_backend_gate.md) — item D, the socket heartbeat quoted
 * in full. Signs in as the SUPERVISOR on the web console origin, opens `/ws` with that session's
 * cookie, prints the two messages the server sends (hello, then the first heartbeat), validates
 * the heartbeat against the contract's `HeartbeatSchema`, and signs out again so that the probe
 * leaves no open session behind.
 *
 * No credential value is printed: the cookie is shown by name, length and attributes only.
 */
import { readFileSync } from 'node:fs';
import WebSocket from 'ws';
import { HeartbeatSchema } from '@dems/shared/api';
import { DEMO_OPERATOR_PASSWORD, OPERATORS } from '/Users/gsp-budi/Documents/DEMS/packages/shared/src/sim/dataset.ts';

const API = 'http://127.0.0.1:4420/api/v1';
const WEB_ORIGIN = 'http://127.0.0.1:5173';
const supervisor = OPERATORS.find((operator) => operator.role === 'SUPERVISOR');

const signedIn = await fetch(`${API}/auth/sign-in`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: WEB_ORIGIN },
  body: JSON.stringify({ username: supervisor.username, password: DEMO_OPERATOR_PASSWORD }),
});
const setCookie = signedIn.headers.get('set-cookie') ?? '';
const [pair, ...attributes] = setCookie.split(';')[0].split(', ')[0].split(';');
const cookie = pair;
console.log(`sign-in status=${signedIn.status} cookie=${pair.split('=')[0]} (${pair.split('=')[1]?.length ?? 0} chars) attributes=${JSON.stringify(attributes.map((a) => a.trim()))}`);

const socket = new WebSocket('ws://127.0.0.1:4420/ws', { headers: { cookie, origin: WEB_ORIGIN } });
const got = [];
const done = new Promise((resolve) => {
  const timer = setTimeout(() => resolve('timed out after 8 s'), 8_000);
  socket.on('message', (data) => {
    const message = JSON.parse(String(data));
    got.push(message);
    if (message.type === 'heartbeat') {
      clearTimeout(timer);
      resolve('heartbeat received');
    }
  });
  socket.on('error', (error) => {
    clearTimeout(timer);
    resolve(`error: ${error.name}`);
  });
  socket.on('close', (code) => resolve(`closed ${code}`));
});
const outcome = await done;
for (const message of got) {
  console.log(`ws message: ${JSON.stringify(message)}`);
}
const hello = got.find((m) => m.type === 'hello');
const beat = got.find((m) => m.type === 'heartbeat');
const parsed = beat ? HeartbeatSchema.safeParse(beat) : null;
console.log(
  `heartbeat check: outcome=${outcome} hello_epoch=${hello?.epoch} hello_revision=${hello?.revision} ` +
    `heartbeat_validates_against_HeartbeatSchema=${parsed?.success} ` +
    `seq=${beat?.seq} intervalMs=${beat?.intervalMs} clients=${beat?.clients} sessionState=${beat?.sessionState} uptimeMs=${beat?.uptimeMs}`,
);

const signedOut = await fetch(`${API}/auth/sign-out`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: WEB_ORIGIN, cookie },
  body: JSON.stringify({ reason: 'USER' }),
});
console.log(`sign-out status=${signedOut.status}`);
socket.close(1000, 'probe done');
process.exit(beat && parsed?.success ? 0 : 1);
