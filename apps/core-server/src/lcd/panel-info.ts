/**
 * Operation 114 `getPanelFirmware`: the firmware word the LCD front panel states about ITSELF.
 *
 * The bridge of `./bridge.ts` WRITES the picture of a recording to the panel and reports whether the
 * panel answered. This file only READS one thing back: the version string the tool said in a line of
 * its own (`panel_fw` of the backend's `/api/dems/status`) and the backend's word for the panel link
 * (`verdict`). It is the second reader of that URL and shares nothing with the bridge but the URL.
 *
 * WHY A CALLER NEEDS NO SESSION. The screen that shows the value is the sign-in screen, which has no
 * credential yet, so the registry entry of this operation is `PUBLIC` (as `getServiceHealth` and
 * `getSignInStatus` are). The answer holds two short strings and nothing else — no evidence data, no
 * session data — and the trade against the disclosure `GET /api/v1/health` already makes is written
 * into that entry (`packages/shared/src/api/lcd-panel.ts`).
 *
 * NEVER A FAILURE. No bridge configured, no backend listening, a backend slower than one second, or a
 * body that is not what the backend's schema says: all of them answer `200` with empty strings, so a
 * machine without a front panel keeps a working sign-in screen. The backend is asked at most once per
 * five seconds (`PANEL_INFO_CACHE_MS`), and a second caller that arrives while a call is in flight
 * joins that call rather than opening another one.
 *
 * THIS FILE ONLY READS. The route is registered by the devices unit (`src/modules/devices/index.ts`),
 * because a route of this server is registered by a module and nowhere else (decision D82); the unit
 * builds the reader below from `app.config.lcdBackendUrl` and answers its handler from it.
 */
import { PANEL_FIRMWARE_MAX_LENGTH, PANEL_VERDICT_MAX_LENGTH, type PanelFirmwareResponse } from '@dems/shared/api';
import { z } from 'zod';

/** How long one answer of the panel backend is reused (the sign-in screen polls; the tool must not be flooded). */
export const PANEL_INFO_CACHE_MS = 5_000;
/** How long the backend may take to answer. Past it the read is "nothing is known", not an error. */
const TIMEOUT_MS = 1_000;
/** The same body cap the bridge holds against `/api/dems/status`. */
const MAX_BODY_BYTES = 16_384;

/** The two members this reader uses. The backend's other members are its own business. */
const BackendPanelWords = z.object({ panel_fw: z.string().optional(), verdict: z.string().optional() });

/** What the Core knows of the panel when the backend gave it nothing. */
const NOTHING_KNOWN: PanelFirmwareResponse = { panelFirmware: '', verdict: '' };

/** The registry operation this file answers, and the only reason the route exists. */
export const PANEL_FIRMWARE_OPERATION_ID = 'getPanelFirmware';

/**
 * The one reader of the panel's two words. `url` is `app.config.lcdBackendUrl`: an empty string means
 * this Core has no panel bridge at all, and the reader then answers without touching the network.
 */
export function createPanelFirmwareReader(options: {
  url: string;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}) {
  const fetcher = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
  const now = options.now ?? Date.now;
  let cached: { readonly at: number; readonly value: PanelFirmwareResponse } | null = null;
  let inflight: Promise<PanelFirmwareResponse> | null = null;

  /** What the backend says, or nothing known. This function never throws. */
  async function ask(): Promise<PanelFirmwareResponse> {
    if (options.url === '') return NOTHING_KNOWN;
    try {
      const response = await fetcher(`${options.url}/api/dems/status`, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) return NOTHING_KNOWN;
      const text = await response.text();
      if (text.length > MAX_BODY_BYTES) return NOTHING_KNOWN;
      const parsed = BackendPanelWords.safeParse(JSON.parse(text) as unknown);
      if (!parsed.success) return NOTHING_KNOWN;
      // What the tool stated, kept as it was said: trimmed, and bounded by the length the contract gives.
      return {
        panelFirmware: (parsed.data.panel_fw ?? '').trim().slice(0, PANEL_FIRMWARE_MAX_LENGTH),
        verdict: (parsed.data.verdict ?? '').trim().slice(0, PANEL_VERDICT_MAX_LENGTH),
      };
    } catch {
      // Unreachable, slow, not JSON, or a shape the backend does not make: the screen shows "unknown".
      return NOTHING_KNOWN;
    }
  }

  return {
    /** The panel's two words, from the cache when the cache is young enough. */
    async read(): Promise<PanelFirmwareResponse> {
      if (cached !== null && now() - cached.at < PANEL_INFO_CACHE_MS) return cached.value;
      if (inflight !== null) return inflight;
      inflight = ask().then((value) => {
        cached = { at: now(), value };
        return value;
      });
      try {
        return await inflight;
      } finally {
        inflight = null;
      }
    },
  };
}
