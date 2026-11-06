/**
 * WS probe (masterplan/01_specs.md §3.6).
 *
 * Usage: tsx scripts/ws-probe.ts [--url ws://127.0.0.1:4400/ws] [--count 3] [--timeout 3500] [--origin <origin>]
 * Prints one line per heartbeat: `seq=<n> serverTime=<iso> clients=<k>`.
 *
 * Exit codes: 0 = `count` schema-valid heartbeats with strictly increasing seq within `timeout`;
 *             1 = timeout, connection failure or an invalid message; 2 = upgrade rejected (HTTP 403).
 */
import { parseArgs } from 'node:util';
import WebSocket from 'ws';
import { CORE_WS_URL, HeartbeatSchema } from '@dems/shared/api';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: CORE_WS_URL },
    count: { type: 'string', default: '3' },
    timeout: { type: 'string', default: '3500' },
    origin: { type: 'string' },
  },
});

const url = values.url;
const count = Number.parseInt(values.count, 10);
const timeoutMs = Number.parseInt(values.timeout, 10);

if (!Number.isInteger(count) || count < 1 || !Number.isInteger(timeoutMs) || timeoutMs < 1) {
  console.error('usage: ws-probe [--url <ws-url>] [--count <n>=1..] [--timeout <ms>] [--origin <origin>]');
  process.exit(1);
}

let finished = false;
function finish(code: 0 | 1 | 2, message?: string): void {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  if (message) (code === 0 ? console.log : console.error)(message);
  if (code === 0 && socket.readyState === WebSocket.OPEN) {
    // Clean close (1000) so the server logs a normal disconnect; exit once acknowledged.
    socket.once('close', () => process.exit(0));
    socket.close(1000, 'probe done');
    setTimeout(() => process.exit(0), 1000).unref();
    return;
  }
  socket.terminate();
  process.exit(code);
}

const startedAt = Date.now();
const timer = setTimeout(
  () => finish(1, `timeout: fewer than ${count} heartbeats within ${timeoutMs} ms`),
  timeoutMs,
);

const socket = new WebSocket(url, values.origin === undefined ? {} : { origin: values.origin });
let received = 0;
let lastSeq = -1;

socket.on('unexpected-response', (_request, response) => {
  finish(2, `upgrade rejected: HTTP ${response.statusCode}`);
});

socket.on('error', (error) => {
  finish(1, `connection error: ${error.message}`);
});

socket.on('message', (data) => {
  let json: unknown;
  try {
    json = JSON.parse(data.toString());
  } catch {
    finish(1, 'invalid message: not JSON');
    return;
  }
  const parsed = HeartbeatSchema.safeParse(json);
  if (!parsed.success) {
    finish(1, `invalid message: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
    return;
  }
  const beat = parsed.data;
  if (beat.seq <= lastSeq) {
    finish(1, `seq not strictly increasing: ${beat.seq} after ${lastSeq}`);
    return;
  }
  lastSeq = beat.seq;
  received += 1;
  console.log(`seq=${beat.seq} serverTime=${beat.serverTime} clients=${beat.clients}`);
  if (received >= count) {
    finish(0, `ok: ${received} heartbeats in ${Date.now() - startedAt} ms`);
  }
});
