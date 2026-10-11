// Fix wave L, driver L-S - re-check 94 finding G94c-01, the Core's half: WHAT A READER SEES ON THE
// WIRE when a stream is cut at a fragment that fails authentication. The verifier measured that the
// cut ends at once when asked straight at the Core and hangs behind the web dev server's proxy. The
// existing tests use the in-process client; this one opens a real loopback socket (it needs loopback
// bind: run outside the command sandbox).
//
// | Rule | Test |
// |------|------|
// | The cut is UNMISTAKABLE on the Core's own socket: status 206 with the full `content-length`, the bytes before the failed fragment and none of it, then the connection is DESTROYED (the body never completes) - at once, also on a keep-alive connection, which is not left open for another request | 1 |
// | The same request from the byte of the cut: the clean `409`, and its body IS the contract example `MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE` the clients' player tests import | 2 |
// | CONTROL: an untampered file on the same kind of connection completes, and the connection stays usable | 3 |
import { Agent, createServer, request as httpRequest, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ApiErrorSchema, MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE, MEDIA_FRAGMENT_NOT_AUTHENTIC_REASON } from '@dems/shared/api';
import { cameraFilePath } from '@dems/shared/evidence-package';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { flipByte } from '../../../evidence-verify/__tests__/support';
import { operatorOf } from '../../devices/__tests__/support';
import { mediaApp, removeMediaScratch, type MediaApp } from './support';

const apps: FastifyInstance[] = [];
const agents: Agent[] = [];
const servers: Server[] = [];
afterEach(async () => {
  for (const agent of agents.splice(0)) agent.destroy();
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const app of apps.splice(0)) await app.close();
});
afterAll(removeMediaScratch);

// The builder's file: 129 clear bytes, five sealed fragments of 700 bytes, 17 clear bytes.
const HEADER = 129;
const FRAGMENT = 700;
const SIZE = HEADER + 5 * FRAGMENT + 17;
const THIRD = HEADER + 2 * FRAGMENT;
const FILE = 'VIDEO-02';

interface Wire {
  status: number;
  headers: IncomingMessage['headers'];
  body: Buffer;
  /** The body ended as HTTP says a body ends (all of `content-length` arrived). */
  complete: boolean;
  /** The connection was torn down under the body. */
  aborted: boolean;
  /** Milliseconds from the first byte of the answer to its end, whichever way it ended. */
  endedAfterMs: number;
  socketDestroyed: boolean;
}

async function listening(): Promise<{ media: MediaApp; origin: string; path: string }> {
  const media = await mediaApp();
  apps.push(media.app);
  media.actAs(operatorOf('INVESTIGATOR'));
  const opened = await media.open({ fileId: FILE });
  if (opened.statusCode !== 201) throw new Error(`operation 88 answered ${opened.statusCode}`);
  // The app's own request handling behind a plain loopback listener: `listen()` of the app would also start the
  // realtime pacing, which this stand-in engine does not take. What answers a request is the same code either way.
  const server = createServer((request, response) => media.app.routing(request, response));
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return { media, origin: `http://127.0.0.1:${port}`, path: new URL((opened.json() as { url: string }).url).pathname };
}

/** One GET over a real socket. Resolves however the answer ends; rejects only when no answer starts within the limit. */
function get(origin: string, path: string, range: string, agent: Agent): Promise<Wire> {
  return new Promise<Wire>((resolve, reject) => {
    const limit = setTimeout(() => reject(new Error('the answer did not end within 5 s: the connection HANGS')), 5_000);
    const request = httpRequest(`${origin}${path}`, { method: 'GET', headers: { range }, agent }, (response) => {
      const startedAt = Date.now();
      // Held from the start: a completed answer on a keep-alive connection gives its socket back, and `response.socket` is null then.
      const socket = response.socket;
      const chunks: Buffer[] = [];
      let aborted = false;
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        clearTimeout(limit);
        resolve({ status: response.statusCode ?? 0, headers: response.headers, body: Buffer.concat(chunks), complete: response.complete, aborted, endedAfterMs: Date.now() - startedAt, socketDestroyed: socket.destroyed });
      };
      response.on('data', (chunk: Buffer) => void chunks.push(chunk));
      response.on('aborted', () => void (aborted = true));
      response.on('error', () => void (aborted = true));
      response.on('close', finish);
      response.on('end', () => setImmediate(finish));
    });
    request.on('error', (error) => {
      clearTimeout(limit);
      reject(error);
    });
    request.end();
  });
}

const keepAlive = (): Agent => {
  const agent = new Agent({ keepAlive: true, maxSockets: 1 });
  agents.push(agent);
  return agent;
};

describe('G94c-01 (the Core\'s half): a stream cut at a fragment that fails authentication, on a real socket', () => {
  it('1. the answer starts as 206 with the full length, hands over the bytes BEFORE the fragment, and the connection is destroyed at once - never left open', async () => {
    const { media, origin, path } = await listening();
    flipByte(media.built.path(cameraFilePath(FILE)), media.built.fragment(FILE, 3).byteOffset + 5);
    const agent = keepAlive();
    const cut = await get(origin, path, 'bytes=0-', agent);
    expect([cut.status, cut.headers['content-length'], cut.headers['content-range']]).toEqual([206, String(SIZE), `bytes 0-${SIZE - 1}/${SIZE}`]);
    // Fewer bytes than told, none of the failed fragment or behind it.
    expect(cut.body.byteLength).toBeLessThanOrEqual(THIRD);
    expect(cut.body.byteLength).toBeLessThan(SIZE);
    // THE UNMISTAKABLE END: the body did not complete and the socket is gone. A reader on this socket cannot wait for more.
    expect(cut.complete).toBe(false);
    expect(cut.aborted).toBe(true);
    expect(cut.socketDestroyed).toBe(true);
    expect(cut.endedAfterMs).toBeLessThan(2_000);
    // The keep-alive agent holds no socket of that answer for a next request.
    expect(Object.values(agent.freeSockets).flat()).toHaveLength(0);
    // The stop is audited with the bytes handed over.
    expect(media.appended.at(-1)).toMatchObject({ type: 'EVIDENCE_MEDIA_SERVED', severity: 'WARNING', message: `Media stream stopped: ${FILE} fragment 3 (FRAGMENT_NOT_AUTHENTIC)` });
  });

  it('2. asked again from the byte of the cut: the clean 409, and its body is the exported contract example', async () => {
    const { media, origin, path } = await listening();
    flipByte(media.built.path(cameraFilePath(FILE)), media.built.fragment(FILE, 3).byteOffset + 5);
    const agent = keepAlive();
    const cut = await get(origin, path, 'bytes=0-', agent);
    expect(cut.body.byteLength).toBe(THIRD);
    const refused = await get(origin, path, `bytes=${cut.body.byteLength}-`, agent);
    expect(refused.status).toBe(MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE.status);
    expect(refused.complete).toBe(true);
    expect(String(refused.headers['content-type'])).toMatch(/json/);
    const body = JSON.parse(refused.body.toString('utf8')) as { error: { requestId: string } & Record<string, unknown> };
    expect(typeof body.error.requestId).toBe('string');
    expect(ApiErrorSchema.safeParse(body).success).toBe(true);
    expect(ApiErrorSchema.safeParse(MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE.body).success).toBe(true);
    // Member for member: only the request ID is the request's own.
    expect({ error: { ...body.error, requestId: MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE.body.error.requestId } }).toEqual(MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE.body);
    expect(MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE.body.error.details).toEqual({ simCode: 'MEDIA_NOT_AVAILABLE', reason: MEDIA_FRAGMENT_NOT_AUTHENTIC_REASON, fileId: FILE, seq: 3 });
  });

  it('3. CONTROL: an untampered file completes on the same kind of connection, and the connection stays usable', async () => {
    const { origin, path } = await listening();
    const agent = keepAlive();
    const whole = await get(origin, path, 'bytes=0-', agent);
    expect([whole.status, whole.body.byteLength, whole.complete, whole.aborted]).toEqual([206, SIZE, true, false]);
    const again = await get(origin, path, `bytes=${HEADER}-${HEADER + 9}`, agent);
    expect([again.status, again.body.byteLength, again.complete]).toEqual([206, 10, true]);
  });
});
