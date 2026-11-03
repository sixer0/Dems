import { createServer } from 'node:http';
import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIdleState, buildScenarioState } from '@dems/shared/sim';
import { pickDurable } from '../db/mapping';
import { parseLcdBackendUrl } from '../config';
import { createLcdBridge, lcdChannelsOf } from './bridge';

const stateOf = () => pickDurable(buildScenarioState('recording', createIdleState({ now: Date.now(), seed: 123 })));
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

describe('LCD configuration and truth', () => {
  it('is opt-in and accepts only an explicit loopback HTTP port', () => {
    expect(parseLcdBackendUrl(undefined)).toBeNull();
    expect(parseLcdBackendUrl('http://127.0.0.1:8090/')).toBe('http://127.0.0.1:8090');
    expect(parseLcdBackendUrl('http://127.0.0.1:80')).toBe('http://127.0.0.1:80');
    for (const value of ['http://localhost:8090', 'http://example.com:8090', 'http://127.0.0.1:0', 'http://127.0.0.1:99999', 'http://127.0.0.1:8090/path', 'http://a@127.0.0.1:8090', 'https://127.0.0.1:8090']) {
      expect(() => parseLcdBackendUrl(value)).toThrow();
    }
  });

  it('reports durable recording per track; clears lost, unused and stopped channels', () => {
    const state = stateOf();
    expect(lcdChannelsOf(state, 4, false).map((c) => c.recording)).toEqual([true, true, false, false]);
    state.cameras[0]!.recState = 'DEGRADED';
    expect(lcdChannelsOf(state, 2, false)[0]?.recording).toBe(true);
    state.cameras[0]!.recState = 'LOST';
    expect(lcdChannelsOf(state, 2, false).map((c) => c.recording)).toEqual([false, true]);
    state.session!.state = 'STOPPING';
    expect(lcdChannelsOf(state, 2, false).some((c) => c.recording)).toBe(false);
    state.session!.state = 'RECORDING';
    state.session!.captureDurable = false;
    expect(lcdChannelsOf(state, 2, false).some((c) => c.recording)).toBe(false);
    expect(lcdChannelsOf(null, 4, true).some((c) => c.recording || c.cameraConnected)).toBe(false);
  });

  it('requires an assigned live stream and explicit durability for real capture', () => {
    const state = stateOf();
    delete state.session!.captureDurable;
    expect(lcdChannelsOf(state, 2, true).some((c) => c.recording)).toBe(false);
    state.session!.captureDurable = true;
    expect(lcdChannelsOf(state, 2, true)[0]?.recording).toBe(true);
    state.captureConfig.cameras[0]!.streamState = 'LOST';
    expect(lcdChannelsOf(state, 2, true)[0]?.recording).toBe(false);
    state.captureConfig.cameras = [];
    expect(lcdChannelsOf(state, 2, true).some((c) => c.cameraConnected)).toBe(false);
  });
});

describe('LCD bridge HTTP integration', () => {
  async function rig() {
    const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
    let fail = false;
    const server = createServer(async (req, res) => {
      if (fail) { res.writeHead(503).end(); return; }
      if (req.method === 'POST') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        posts.push({ path: req.url!, body: JSON.parse(Buffer.concat(chunks).toString()) });
        res.end(JSON.stringify({ v: 2, n: 4, health: 'ok' }));
      } else res.end(JSON.stringify({ n: 4, health: 'ok', last_req_ms: Date.now() - 1_000, tx: 1 }));
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    cleanups.push(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); });
    const port = (server.address() as { port: number }).port;
    return { posts, url: `http://127.0.0.1:${port}`, fail: () => { fail = true; } };
  }

  it('sends leases, renews, stops on state loss and shuts down all channels', async () => {
    const r = await rig();
    let state: ReturnType<typeof stateOf> | null = stateOf();
    let now = Date.now();
    const bridge = createLcdBridge({ url: r.url, real: false, readState: () => state, now: () => now });
    await Promise.all([bridge.tick(), bridge.tick()]);
    expect(r.posts).toHaveLength(4);
    expect(r.posts[0]).toMatchObject({ path: '/api/dems/ch/1/status', body: { rec: 'start', cam: true, lease: 6, clear_file: true } });
    expect(r.posts[2]?.body).toMatchObject({ rec: 'stop', cam: false });
    expect(bridge.status()).toMatchObject({ reachable: true, panelConnected: true, error: null });
    now += 7_000;
    expect(bridge.status()).toMatchObject({ reachable: false, channels: [], error: 'UNAVAILABLE' });
    now = Date.now();
    state = null;
    await bridge.tick();
    expect(r.posts.slice(4).every((p) => p.body['rec'] === 'stop')).toBe(true);
    expect(bridge.status().error).toBe('CORE_NOT_READY');
    await bridge.close();
    expect(r.posts).toHaveLength(12);
    await bridge.tick();
    expect(r.posts).toHaveLength(12);
  });

  it('drops stale success when the backend fails', async () => {
    const r = await rig();
    const bridge = createLcdBridge({ url: r.url, real: false, readState: stateOf });
    await bridge.tick();
    r.fail();
    await bridge.tick();
    expect(bridge.status()).toMatchObject({ reachable: false, panelConnected: null, channels: [], error: 'UNAVAILABLE' });
    await bridge.close();
  });

  it('rejects invalid/oversize responses and does not treat HTTP as proof of USB', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('x'.repeat(20_000)));
    const bridge = createLcdBridge({ url: 'http://127.0.0.1:8090', real: false, readState: stateOf, fetch: fetcher });
    await bridge.tick();
    expect(bridge.status()).toMatchObject({ error: 'INVALID_RESPONSE', panelConnected: null });
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' });
    await bridge.close();
  });
});
