import { createServer } from 'node:http';
import { once } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIdleState, buildScenarioState } from '@dems/shared/sim';
import { pickDurable } from '../db/mapping';
import { parseLcdBackendUrl } from '../config';
import { LcdIntegrationStatusSchema } from '@dems/shared/api';
import { createLcdBridge, lcdChannelsOf } from './bridge';

// Row L3: a deep copy. `pickDurable` hands on objects the scenario builder shares between builds, so a case that edits a line (streamState, reach) leaked it into every later case.
const stateOf = () => structuredClone(pickDurable(buildScenarioState('recording', createIdleState({ now: Date.now(), seed: 123 }))));
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
    expect(lcdChannelsOf(state, 4, false).map((c) => c.recording)).toEqual([true, true, true, true]); // D60 (2026-11-04): the model records four cameras at once - four busy channels; the unused ones follow:
    expect(lcdChannelsOf(state, 6, false).map((c) => c.recording)).toEqual([true, true, true, true, false, false]); // two unused channels beyond the four tracks
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

  describe('row L3 (D104): the camera lamp reads the assigned device plus its reach, as operations 44 / 46 do', () => {
    /** The registry entry of the device assigned to `track` (the scenario holds one per assigned camera). */
    const deviceOf = (state: ReturnType<typeof stateOf>, track: string) => {
      const id = state.captureConfig.cameras.find((line) => line.trackId === track)!.deviceId;
      return state.captureDevices.devices.find((entry) => entry.id === id && entry.kind === 'CAMERA')!;
    };

    it('CONTROL: stored READY, assigned, online, no reach reading with an open (LIVE) stream, or REACHABLE -> connected on every lane', () => {
      const state = stateOf();
      expect(lcdChannelsOf(state, 4, true).map((c) => c.cameraConnected)).toEqual([true, true, true, true]);
      deviceOf(state, 'VIDEO-01').reach = 'REACHABLE';
      expect(lcdChannelsOf(state, 4, true)[0]?.cameraConnected).toBe(true);
    });

    it('stored READY + NOT_REACHABLE -> not connected on the panel (real capture); the other channels and the REC lamp keep their own facts', () => {
      const state = stateOf();
      state.session!.captureDurable = true;
      expect(state.cameras[0]).toMatchObject({ online: true, lens: 'READY' }); // the stored row still says READY
      deviceOf(state, 'VIDEO-01').reach = 'NOT_REACHABLE';
      const channels = lcdChannelsOf(state, 4, true);
      expect(channels.map((c) => c.cameraConnected)).toEqual([false, true, true, true]);
      expect(channels[0]?.recording).toBe(true); // a reach reading never stops the REC lamp of a stream the Core records
    });

    it('assigned device offline in the registry, or absent from it -> not connected (real capture)', () => {
      const state = stateOf();
      deviceOf(state, 'VIDEO-02').online = false;
      expect(lcdChannelsOf(state, 4, true).map((c) => c.cameraConnected)).toEqual([true, false, true, true]);
      state.captureDevices.devices = state.captureDevices.devices.filter((entry) => entry.kind !== 'CAMERA');
      expect(lcdChannelsOf(state, 4, true).some((c) => c.cameraConnected)).toBe(false);
    });

    describe('row L3b (D158, O-163-1): the lamp lights only on a stated REACHABLE or an open source', () => {
      /** After a Core start: no reach reading since boot and no open stream on any track. */
      const atRestAfterStart = () => {
        const state = stateOf();
        for (const line of state.captureConfig.cameras) line.streamState = null;
        for (const entry of state.captureDevices.devices) delete (entry as { reach?: unknown }).reach;
        return state;
      };

      it('REACHABLE lights the lamp (no open stream needed)', () => {
        const state = atRestAfterStart();
        deviceOf(state, 'VIDEO-01').reach = 'REACHABLE';
        expect(lcdChannelsOf(state, 4, true).map((c) => c.cameraConnected)).toEqual([true, false, false, false]);
      });

      it('NOT_REACHABLE does not light it, with or without an open stream', () => {
        const state = atRestAfterStart();
        deviceOf(state, 'VIDEO-01').reach = 'NOT_REACHABLE';
        expect(lcdChannelsOf(state, 4, true)[0]?.cameraConnected).toBe(false);
        state.captureConfig.cameras.find((line) => line.trackId === 'VIDEO-01')!.streamState = 'LIVE';
        expect(lcdChannelsOf(state, 4, true)[0]?.cameraConnected).toBe(false);
      });

      it('no reach stated (NOT_CHECKED) and no open stream -> unlit, not "connected" (the panel has no third state)', () => {
        const state = atRestAfterStart();
        expect(lcdChannelsOf(state, 4, true).map((c) => c.cameraConnected)).toEqual([false, false, false, false]);
        state.captureConfig.cameras.find((line) => line.trackId === 'VIDEO-02')!.streamState = 'LOST';
        expect(lcdChannelsOf(state, 4, true)[1]?.cameraConnected).toBe(false);
        state.captureConfig.cameras.find((line) => line.trackId === 'VIDEO-03')!.streamState = 'LIVE'; // an open source
        expect(lcdChannelsOf(state, 4, true).map((c) => c.cameraConnected)).toEqual([false, false, true, false]);
      });

      it('CONTROL simulated lane at rest after a start: unchanged, every lamp lit', () => {
        expect(lcdChannelsOf(atRestAfterStart(), 4, false).map((c) => c.cameraConnected)).toEqual([true, true, true, true]);
      });

      it('the REC lamp keeps its own facts (unchanged by L3b)', () => {
        const state = stateOf();
        state.session!.captureDurable = true;
        for (const entry of state.captureDevices.devices) delete (entry as { reach?: unknown }).reach;
        expect(lcdChannelsOf(state, 4, true).map((c) => c.recording)).toEqual([true, true, true, true]);
      });
    });

    it('CONTROL simulated lane: unchanged, a reach reading is not read', () => {
      const state = stateOf();
      deviceOf(state, 'VIDEO-01').reach = 'NOT_REACHABLE';
      deviceOf(state, 'VIDEO-02').online = false;
      expect(lcdChannelsOf(state, 4, false).map((c) => c.cameraConnected)).toEqual([true, true, true, true]);
    });

    it('the channel payload keeps its shape (no protocol change)', () => {
      const state = stateOf();
      deviceOf(state, 'VIDEO-01').reach = 'NOT_REACHABLE';
      for (const channel of lcdChannelsOf(state, 4, true)) {
        expect(Object.keys(channel)).toEqual(['channel', 'track', 'deviceId', 'cameraConnected', 'recording']);
      }
      expect(LcdIntegrationStatusSchema.shape.channels.safeParse(lcdChannelsOf(state, 4, true)).success).toBe(true);
    });
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
    expect(r.posts[2]?.body).toMatchObject({ rec: 'start', cam: true }); // D60 (2026-11-04): the third channel carries the third camera - no unused channel inside four; the stops come on state loss below
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

  it('row L3: a real-capture bridge posts cam false for a channel whose assigned camera is NOT_REACHABLE (same body members)', async () => {
    const r = await rig();
    const state = stateOf();
    const id = state.captureConfig.cameras.find((line) => line.trackId === 'VIDEO-01')!.deviceId;
    state.captureDevices.devices.find((entry) => entry.id === id && entry.kind === 'CAMERA')!.reach = 'NOT_REACHABLE';
    const bridge = createLcdBridge({ url: r.url, real: true, readState: () => state });
    await bridge.tick();
    expect(r.posts.map((p) => p.body['cam'])).toEqual([false, true, true, true]);
    expect(Object.keys(r.posts[0]!.body).sort()).toEqual(['cam', 'clear_file', 'dev', 'lease', 'rec']);
    expect(r.posts[0]?.body['dev']).toBe(id);
    await bridge.close();
  });

  it('row L3b: after a Core start (no reach, no open stream) a real bridge posts cam false; a REACHABLE camera posts true', async () => {
    const r = await rig();
    const state = stateOf();
    for (const line of state.captureConfig.cameras) line.streamState = null;
    for (const entry of state.captureDevices.devices) delete (entry as { reach?: unknown }).reach;
    const id = state.captureConfig.cameras.find((line) => line.trackId === 'VIDEO-02')!.deviceId;
    state.captureDevices.devices.find((entry) => entry.id === id && entry.kind === 'CAMERA')!.reach = 'REACHABLE';
    const bridge = createLcdBridge({ url: r.url, real: true, readState: () => state });
    await bridge.tick();
    expect(r.posts.map((p) => p.body['cam'])).toEqual([false, true, false, false]);
    expect(Object.keys(r.posts[1]!.body).sort()).toEqual(['cam', 'clear_file', 'dev', 'lease', 'rec']);
    await bridge.close();
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
