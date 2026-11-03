/**
 * The live camera preview of the web console: the rules of operation 112 `createCameraPreviewSession`
 * (decisions D51 / D53; part (d) of the D53 plan, row 92). Kept in a `.ts` module so that
 * `camera-preview.tsx` exports only components.
 *
 * | Rule | Where |
 * |------|-------|
 * | Live mode only, a Core in real capture, a PRODUCTION camera on the track: the Core has no preview of anything else (it would answer `409 PREVIEW_NOT_AVAILABLE`) | `isLivePreviewDevice` |
 * | Only the PATH of the answered URL is used (`/preview/cps_…`), resolved against this console's own origin: the route asks for the operator's session cookie, and the Core names its loopback address (dev: the `/preview` entry of the Vite proxy) | `previewPathOf` |
 * | A picture that fails is asked for again after 2 s, 4 s, 8 s … at most 30 s | `previewRetryDelayMs` |
 * | `429 PREVIEW_LIMIT`: "too many previews", asked again after the Core's `retry-after` (at least the backoff) | `previewRefusalOf` |
 * | `409` with `details.cause: AUTH_REFUSED`: the camera refused the stored password; the Core refuses again for 5 min, so the console waits that long | `previewRefusalOf` |
 * | `409 PREVIEW_NOT_AVAILABLE` without a cause: asked again after a minute | `previewRefusalOf` |
 * | While a session starts (CREATE, PRECHECK, ARMED) the Core yields the camera to the recording: the tile says the preview is paused | `isSessionStarting` |
 *
 * THE URL IS A BEARER VALUE: it is set on the `<img>` and nowhere else - never logged, never put in a
 * record, a storage or a test id.
 */
import { SessionState } from '@dems/shared/domain'
import { CaptureSourceClass } from '@dems/shared/api'

/** The first wait before a failed picture is asked for again. */
export const PREVIEW_RETRY_FIRST_MS = 2_000
/** The longest wait of the backoff. */
export const PREVIEW_RETRY_MAX_MS = 30_000
/** After the camera refused the credential: the Core's own refusal window (`AUTH_REFUSED`, 5 min). */
export const PREVIEW_AUTH_REFUSED_RETRY_MS = 5 * 60_000
/** After `409 PREVIEW_NOT_AVAILABLE` without a cause. */
export const PREVIEW_NOT_AVAILABLE_RETRY_MS = 60_000
/** `details.cause` of the 409 for a camera that refused the stored password. */
export const PREVIEW_AUTH_REFUSED_CAUSE = 'AUTH_REFUSED'

/** The wait before attempt `failures + 1` after `failures` failures in a row (1 -> 2 s, 2 -> 4 s, … capped at 30 s); pure. */
export function previewRetryDelayMs(failures: number): number {
  const steps = Math.max(0, Math.floor(failures) - 1)
  return Math.min(PREVIEW_RETRY_MAX_MS, PREVIEW_RETRY_FIRST_MS * 2 ** Math.min(steps, 10))
}

/** The path of the preview route in an answered URL (`/preview/cps_…`), or null for anything else. The host of the URL is never used. */
export function previewPathOf(url: unknown): string | null {
  if (typeof url !== 'string') return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  return /^\/preview\/cps_[A-Za-z0-9_-]+$/.test(parsed.pathname) && parsed.search === '' && parsed.hash === '' ? parsed.pathname : null
}

export type PreviewRefusal =
  /** `429 PREVIEW_LIMIT` (or another 429): too many previews are open. */
  | { readonly kind: 'LIMIT'; readonly retryMs: number }
  /** `409` with `cause: AUTH_REFUSED`: the camera refused the stored password. */
  | { readonly kind: 'AUTH_REFUSED'; readonly retryMs: number }
  /** `409 PREVIEW_NOT_AVAILABLE`: no live preview of this device on this Core. */
  | { readonly kind: 'NOT_AVAILABLE'; readonly retryMs: number }
  /** Anything else (an outage, a 5xx, a 404, a 403): not available now, asked again with the backoff. */
  | { readonly kind: 'OTHER'; readonly retryMs: number }

const detailOf = (details: unknown, key: 'reason' | 'cause'): string | null => {
  const value = (details as Record<string, unknown> | null | undefined)?.[key]
  return typeof value === 'string' ? value : null
}

/** What a refused operation 112 is and when to ask again; pure. `failures` counts this refusal. */
export function previewRefusalOf(
  failure: { readonly status: number | null; readonly error: { readonly details?: unknown }; readonly retryAfterSeconds: number | null },
  failures: number,
): PreviewRefusal {
  const backoff = previewRetryDelayMs(failures)
  if (failure.status === 429) {
    // `details.reason` is `PREVIEW_LIMIT` (CAMERA_PREVIEW_LIMIT_REASON); any 429 is said as the limit, after the Core's `retry-after`.
    const after = failure.retryAfterSeconds === null ? 0 : failure.retryAfterSeconds * 1000
    return { kind: 'LIMIT', retryMs: Math.max(backoff, after) }
  }
  if (failure.status === 409) {
    if (detailOf(failure.error.details, 'cause') === PREVIEW_AUTH_REFUSED_CAUSE) return { kind: 'AUTH_REFUSED', retryMs: PREVIEW_AUTH_REFUSED_RETRY_MS }
    return { kind: 'NOT_AVAILABLE', retryMs: PREVIEW_NOT_AVAILABLE_RETRY_MS }
  }
  return { kind: 'OTHER', retryMs: backoff }
}

/** True while a session is being started: the Core yields a camera's preview before the pre-check and before the session opens it. */
export function isSessionStarting(state: string | null | undefined): boolean {
  return state === SessionState.CREATE || state === SessionState.PRECHECK || state === SessionState.ARMED
}

/** Whether the device on a track has a live preview on the Core: a PRODUCTION camera (the Core's own rule of operation 112). */
export function isLivePreviewDevice(device: { readonly kind?: string; readonly sourceClass?: string | null } | undefined): boolean {
  return device !== undefined && device.sourceClass === CaptureSourceClass.PRODUCTION && (device.kind === undefined || device.kind === 'CAMERA')
}
