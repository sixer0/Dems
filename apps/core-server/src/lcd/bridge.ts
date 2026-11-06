import type { LcdIntegrationStatus } from '@dems/shared/api';
import { SessionState, TrackRecState, VIDEO_TRACK_IDS } from '@dems/shared/domain'; // VIDEO_TRACK_IDS: D60 (2026-11-04)
import { SlotSourceState, slotSourceOf } from '@dems/shared/sim'; // audit fix row L3 (D104): row 128's one source rule; row L3b (D158): stated REACHABLE only
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
const TRACKS = VIDEO_TRACK_IDS; // D60 (2026-11-04): the panel's channels follow the four recorded tracks (was two)

/**
 * CH1 to CH4 are DEMS video tracks (D60, 2026-11-04: four recorded tracks; before, CH3/CH4 were
 * unused), not physical device ids. Each line also carries the DEVICE behind the track
 * (`deviceId`), because one dual-lens camera fills two of its tracks (OD-05) and a panel may
 * want one output per physical camera, not per lens.
 * Grouping is the panel's choice: the bridge keeps reporting per track, truthfully.
 *
 * Audit fix row L3 (D104, D116; F-6-14): in a real capture operation the panel's camera lamp
 * (`cameraConnected`, sent as `cam`) also asks the ONE source rule of operations 44 / 46
 * (`slotSourceOf` + `isSlotSourceUp`, row 128): the device ASSIGNED to the track must be in the
 * registry with `online` set, and the Core's last reach reading must not say NOT_REACHABLE. Before,
 * the lamp read only the stored hardware row (`online`, `lens` READY: seeded and never re-stated at
 * rest), so the panel said "camera there" for a camera the console showed FAULT / not reachable.
 * `recording` keeps its own facts (durable session, assigned LIVE stream, REC / DEGRADED): a reach
 * reading never stops a REC lamp of a stream the Core still records - the console likewise shows
 * the track's REC state beside a FAULT lens. A SIMULATED Core is unchanged (no reach rule).
 *
 * Audit fix row L3b (D158, O-163-1; fix wave W4, D232): an honest panel. The lamp has two states
 * only, so it cannot say "Not checked" (D113) as the console does. `isSlotSourceUp` lets NOT_CHECKED
 * draw ready (it claims nothing against the source); a lit lamp, though, is a claim FOR it. So the
 * lamp lights only on a stated REACHABLE, or on an open source (the Core holds the track's stream
 * LIVE, the strongest reach fact there is). No reach reading since a Core start, NOT_REACHABLE,
 * OFFLINE or NOT_ASSIGNED -> unlit. Same reading (`slotSourceOf` over `captureDevices.devices[]`),
 * stricter threshold; NOT_REACHABLE stays unlit even with a LIVE stream (row L3 case kept).
 */
export function lcdChannelsOf(state: CommittedState | null, count: number, real: boolean): LcdIntegrationStatus['channels'] {
  const session = state?.session;
  const recording = session?.state === SessionState.RECORDING &&
    (real ? session.captureDurable === true : session.captureDurable !== false);
  return Array.from({ length: count }, (_, index) => {
    const track = TRACKS[index] ?? null;
    const camera = track === null ? undefined : state?.cameras.find((item) => item.id === track);
    const slot = state?.captureConfig?.cameras.find((item) => item.trackId === track);
    const streamReady = camera?.online === true && camera.lens === 'READY' &&
      (!real || (slot !== undefined && slot.deviceId !== '' && slot.online));
    // Audit fix row L3: the assigned device plus its reach, as operations 44 / 46 read it (real capture only).
    // Row L3b (D158): lit only on a stated REACHABLE or an open (LIVE) stream; NOT_CHECKED no longer lights it.
    const source = real && state !== null && track !== null
      ? slotSourceOf(state.captureConfig, state.captureDevices.devices, track).state : null;
    const cameraConnected = streamReady && (!real || source === SlotSourceState.REACHABLE ||
      (source === SlotSourceState.NOT_CHECKED && slot?.streamState === 'LIVE'));
    return {
      channel: index + 1, track, deviceId: slot?.deviceId ?? null,
      cameraConnected,
      recording: recording && streamReady && (!real || slot?.streamState === 'LIVE') &&
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
    const streamReader = response.body?.getReader(); // an HTTP body reader: NOT the ONVIF time reader of SR-5
    if (!streamReader) throw new InvalidResponse();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      for (;;) {
        const { done, value } = await streamReader.read();
        if (done) break;
        length += value.length;
        if (length > 16_384) throw new InvalidResponse();
        chunks.push(value);
      }
    } finally {
      await streamReader.cancel();
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
