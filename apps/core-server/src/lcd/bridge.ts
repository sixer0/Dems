import type { LcdIntegrationStatus } from '@dems/shared/api';
import { SessionState, TrackRecState } from '@dems/shared/domain';
import { z } from 'zod';
import type { EngineHost } from '../engine';

type CommittedState = ReturnType<EngineHost['state']>;

export const LCD_INTERVAL_MS = 2_000;
export const LCD_LEASE_SECONDS = 6;
const TIMEOUT_MS = 1_000;
const BackendStatus = z.object({
  n: z.number().int().min(2).max(4),
  health: z.enum(['ok', 'warn', 'fail']),
  last_req_ms: z.number().finite().nonnegative(),
  tx: z.number().int().nonnegative(),
});
const PanelReply = z.object({ v: z.literal(2), n: z.number().int(), health: z.enum(['ok', 'warn', 'fail']) });
const TRACKS = ['VIDEO-01', 'VIDEO-02'] as const;

/**
 * CH1/CH2 are DEMS video tracks, not physical device ids; CH3/CH4 remain unused. Each line
 * also carries the DEVICE behind the track (`deviceId`), because one dual-lens camera fills
 * both tracks (OD-05) and a panel may want one output per physical camera, not per lens.
 * Grouping is the panel's choice: the bridge keeps reporting per track, truthfully.
 */
export function lcdChannelsOf(state: CommittedState | null, count: number, real: boolean): LcdIntegrationStatus['channels'] {
  const session = state?.session;
  const recording = session?.state === SessionState.RECORDING &&
    (real ? session.captureDurable === true : session.captureDurable !== false);
  return Array.from({ length: count }, (_, index) => {
    const track = TRACKS[index] ?? null;
    const camera = track === null ? undefined : state?.cameras.find((item) => item.id === track);
    const slot = state?.captureConfig?.cameras.find((item) => item.trackId === track);
    const cameraConnected = camera?.online === true && camera.lens === 'READY' &&
      (!real || (slot !== undefined && slot.deviceId !== '' && slot.online));
    return {
      channel: index + 1, track, deviceId: slot?.deviceId ?? null,
      cameraConnected,
      recording: recording && cameraConnected && (!real || slot?.streamState === 'LIVE') &&
        (camera?.recState === TrackRecState.REC || camera?.recState === TrackRecState.DEGRADED),
    };
  });
}

class InvalidResponse extends Error {}

/** A single serialized heartbeat. It never writes engine state or controls a recording. */
export function createLcdBridge(options: {
  url: string;
  real: boolean;
  readState: () => CommittedState | null;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  let status: LcdIntegrationStatus = {
    backendUrl: options.url, reachable: false, panelConnected: null,
    lastSyncAt: null, health: null, error: null, channels: [],
  };
  let active: Promise<void> | null = null;
  let closed = false;
  let channelCount = 0;

  async function request(path: string, body?: unknown): Promise<unknown> {
    const response = await fetcher(`${options.url}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error('LCD_HTTP_FAILURE');
    const reader = response.body?.getReader();
    if (!reader) throw new InvalidResponse();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 16_384) throw new InvalidResponse();
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
    catch { throw new InvalidResponse(); }
  }

  async function send(channels: LcdIntegrationStatus['channels']): Promise<void> {
    // Each channel has its own camera/recording truth. Do not broadcast a global START.
    const results = await Promise.allSettled(channels.map(async (channel) => {
      const answer = PanelReply.safeParse(await request(`/api/dems/ch/${channel.channel}/status`, {
        rec: channel.recording ? 'start' : 'stop', cam: channel.cameraConnected,
        dev: channel.deviceId ?? '', lease: LCD_LEASE_SECONDS, clear_file: true,
      }));
      if (!answer.success || answer.data.n !== channels.length) throw new InvalidResponse();
    }));
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
  }

  async function sync(): Promise<void> {
    try {
      const before = BackendStatus.safeParse(await request('/api/dems/status'));
      if (!before.success) throw new InvalidResponse();
      channelCount = before.data.n;
      const state = options.readState();
      const channels = lcdChannelsOf(state, channelCount, options.real);
      await send(channels);
      const after = BackendStatus.safeParse(await request('/api/dems/status'));
      if (!after.success || after.data.n !== channelCount) throw new InvalidResponse();
      const at = now();
      const age = at - after.data.last_req_ms;
      status = {
        backendUrl: options.url, reachable: true,
        panelConnected: after.data.last_req_ms > 0 && age >= 0 && age <= 10_000 && after.data.tx > 0,
        lastSyncAt: at, health: after.data.health,
        error: state === null ? 'CORE_NOT_READY' : null, channels,
      };
    } catch (error) {
      // Drop old channel claims on any partial or failed update. The backend lease remains the safety net.
      status = { ...status, reachable: false, panelConnected: null, health: null, channels: [],
        error: error instanceof InvalidResponse ? 'INVALID_RESPONSE' : 'UNAVAILABLE' };
    }
  }

  return {
    status: (): LcdIntegrationStatus => {
      const current = structuredClone(status);
      if (current.lastSyncAt !== null && now() - current.lastSyncAt > LCD_LEASE_SECONDS * 1_000) {
        return { ...current, reachable: false, panelConnected: null, health: null, channels: [], error: 'UNAVAILABLE' };
      }
      return current;
    },
    tick(): Promise<void> {
      if (closed) return Promise.resolve();
      if (active !== null) return active;
      active = sync().finally(() => { active = null; });
      return active;
    },
    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      await active;
      if (channelCount > 0) {
        try { await send(lcdChannelsOf(null, channelCount, options.real)); }
        catch { /* A missing backend clears START through the six-second lease. */ }
      }
    },
  };
}
