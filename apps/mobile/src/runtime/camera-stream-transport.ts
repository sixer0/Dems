/**
 * The ONE request of the live camera preview's stream (task 2026-11-05 row 195, rulings D202 and D217).
 *
 * The preview stream `GET /preview/{token}` is `multipart/x-mixed-replace`: the typed client (`@dems/shared/client`)
 * reads one envelope per answer and cannot hand on an endless body, and the media transport only hands an origin
 * and a header to a native player. So this file makes the request itself, with Expo's streaming fetch, and is the
 * one named allowance of the D69 guard for it (`live-no-raw-fetch.test.tsx`, `CAMERA_STREAM_CALL_LINE`, D217):
 *
 * | Rule | How |
 * |------|-----|
 * | Only a preview path (`/preview/cps_…`) is ever requested | `CAMERA_STREAM_PATH`; anything else is refused before a request |
 * | The Core's own origin and the operator's header come from the Live source's media transport (integration pass D5), never from a constant here | `live.mediaTransport()`; null (no operator session): nothing is requested |
 * | No cookie beside the bearer (D69, F55): Expo's fetch defaults to `include` | `credentials: 'omit'` |
 * | The URL and the token are bearer values: never logged, never returned, never in an error | this file writes no log; a failure is the caller's to name by status or error NAME |
 *
 * The parsing of the body stays with the feature (`features/devices/camera-live-stream.ts`).
 */
import { fetch as streamFetch } from 'expo/fetch';
import { CAMERA_PREVIEW_TOKEN_PREFIX } from '@dems/shared/api';
import type { MobileLiveSim } from './sim-adapters';

/** The only paths this transport requests. */
export const CAMERA_STREAM_PATH = new RegExp(`^/preview/${CAMERA_PREVIEW_TOKEN_PREFIX}[A-Za-z0-9_-]+$`);

/** What the feature gets back: the status, the content type and the body to read. No URL, no header. */
export interface CameraStreamResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly contentType: string | null;
  readonly body: ReadableStream<Uint8Array> | null;
}

export interface OpenCameraStreamInput {
  readonly live: MobileLiveSim;
  /** The path of an op 112 answer (`/preview/cps_…`); a bearer value. */
  readonly path: string;
  readonly signal: AbortSignal;
}

/** The origin and the session header of the Live source, read defensively; null when no operator session is in memory. */
function streamTransportOf(live: MobileLiveSim): { readonly origin: string; readonly authorization: string } | null {
  const provider = (live as { mediaTransport?: unknown }).mediaTransport;
  if (typeof provider !== 'function') return null;
  const transport = (provider as () => unknown).call(live) as { origin?: unknown; headers?: { Authorization?: unknown } } | null;
  if (transport === null || typeof transport !== 'object' || typeof transport.origin !== 'string' || !/^https?:\/\/[^/?#]+$/.test(transport.origin)) return null;
  const authorization = transport.headers?.Authorization;
  return typeof authorization === 'string' && authorization.startsWith('Bearer ') ? { origin: transport.origin, authorization } : null;
}

/** Whether a stream could be opened now (an operator session is in memory); asked before op 112. */
export function cameraStreamTransportReady(live: MobileLiveSim): boolean {
  return streamTransportOf(live) !== null;
}

/**
 * Opens the stream of a preview session. Null without an operator session or for a path that is no preview path
 * (nothing is requested then). Rejects as Expo's fetch does (an `AbortError` after `signal` aborts).
 */
export async function openCameraStream({ live, path, signal }: OpenCameraStreamInput): Promise<CameraStreamResponse | null> {
  const transport = streamTransportOf(live);
  if (transport === null || !CAMERA_STREAM_PATH.test(path)) return null;
  const response = await streamFetch(`${transport.origin}${path}`, { method: 'GET', headers: { Authorization: transport.authorization }, credentials: 'omit', signal });
  return { ok: response.ok, status: response.status, contentType: response.headers.get('content-type'), body: response.body };
}
