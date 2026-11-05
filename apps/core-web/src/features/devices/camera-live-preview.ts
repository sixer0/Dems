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
 * | While a session is being started (CREATE, PRECHECK, ARMED) the Core yields the camera to the recording: the tile says the preview is paused | `isSessionStarting` |
 * | D62 (2026-11-05): on a Devices tile the session opens BY ITSELF when the track is assigned and its selector line reads online - debounced, at most as many as the Core's global pipeline cap (`CAMERA_PREVIEW_LIMITS.pipelines`), closed when the line goes offline or the tab hides | `useAutoPreviewOpen` |
 *
 * THE URL IS A BEARER VALUE: it is set on the `<img>` and nowhere else - never logged, never put in a
 * record, a storage or a test id.
 */
import { useEffect, useState } from 'react'
import { SessionState } from '@dems/shared/domain'
import { CAMERA_PREVIEW_LIMITS, CaptureSourceClass } from '@dems/shared/api'
import { useDocumentVisible } from './idle-meter-lease'

/** The first wait before a failed picture is asked for again. */
export const PREVIEW_RETRY_FIRST_MS = 2_000
/** The longest wait of the backoff. */
export const PREVIEW_RETRY_MAX_MS = 30_000
/** After the camera refused the credential: the Core's own refusal window (`AUTH_REFUSED`, 5 min). */
export const PREVIEW_AUTH_REFUSED_RETRY_MS = 5 * 60_000
/** After `409 PREVIEW_NOT_AVAILABLE` without a cause. */
export const PREVIEW_NOT_AVAILABLE_RETRY_MS = 60_000
/**
 * 2026-11-04 (bench, CAM-03 after its PoE port moved): a host that is SILENT — not refusing — keeps
 * an `<img>` pending for minutes (SYN retransmits, and the dev proxy holds the half-open stream), so
 * neither `load` nor `error` ever arrives and the tile lies "Connecting…" while the Core already
 * ended the stream. A picture with no FIRST FRAME this long after its src was set counts as the
 * failure its events failed to report; the honest sentence and the backoff then follow as usual.
 */
export const PREVIEW_FIRST_FRAME_MS = 10_000
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

// ── D62 (2026-11-05): the Devices tile opens its preview BY ITSELF ──────────────────────────────
//
// The principal's ruling: the console auto-opens the live preview of every assigned+online tile. The
// session itself (`LivePreview` in `camera-preview.tsx`) and its honest rule - the UNAVAILABLE caption
// after 3 frame-less failures, the backoff retry continuing - stay EXACTLY as they were; this gate sits
// ABOVE the session and decides only WHEN a tile mounts it:
//
// | Rule | Where |
// |------|-------|
// | A tile with no device on the track, or one that is not a production camera, never opens anything (Simulated mode asks for nothing at all: no Core, no `LivePreview`) | `CameraPreview` (the caller's `autoPreview`) |
// | Opens only while the selector line of the track reads online; offline closes the session at once | `AutoLivePreview` |
// | Opens only while the tab is visible (`visibilitychange`); hidden closes, visible re-opens | `useAutoPreviewOpen` |
// | ~1 s between the tile becoming eligible and the first token: an offline/online blip costs no request | `PREVIEW_AUTO_OPEN_DEBOUNCE_MS` |
// | At most `CAMERA_PREVIEW_LIMITS.pipelines` auto sessions across the console at once (the Core's
// | global pipeline cap — a third tile would only collect its `429 PREVIEW_LIMIT`); the next tile
// | takes the slot that frees first | `claimPreviewSlot` |

/** D62: the wait between a tile becoming eligible and its first token being asked for. */
export const PREVIEW_AUTO_OPEN_DEBOUNCE_MS = 1_000
/**
 * D62: how many auto preview sessions the console holds open at once — the Core's OWN global
 * pipeline bound (`CAMERA_PREVIEW_LIMITS.pipelines`, shared contract; correction 2026-11-05 after
 * the live bench showed two tiles refusing "too many live previews" under a cap of four, which the
 * Core answers 429 for by contract). A client may not open more pipelines than the Core has.
 */
export const PREVIEW_AUTO_MAX_CONCURRENT = CAMERA_PREVIEW_LIMITS.pipelines

let previewSlotsTaken = 0
const previewSlotWaiters = new Set<() => void>()

/** D62: whether a free auto-preview slot was taken; the holder releases it with `releasePreviewSlot`. */
export function claimPreviewSlot(): boolean {
  if (previewSlotsTaken >= PREVIEW_AUTO_MAX_CONCURRENT) return false
  previewSlotsTaken += 1
  return true
}

/** D62: gives one slot back and tells every waiter, which may take it. */
export function releasePreviewSlot(): void {
  if (previewSlotsTaken === 0) return
  previewSlotsTaken -= 1
  for (const waiter of [...previewSlotWaiters]) waiter()
}

/** D62: told whenever a slot comes free; returns the unsubscribe. */
export function subscribePreviewSlots(listener: () => void): () => void {
  previewSlotWaiters.add(listener)
  return () => {
    previewSlotWaiters.delete(listener)
  }
}

/** D62: how many slots stand taken now (the cap rule, read by tests). */
export function previewSlotsTakenCount(): number {
  return previewSlotsTaken
}

/**
 * D62: when an eligible tile actually opens its session. `true` once `eligible && visible` has stood
 * for `PREVIEW_AUTO_OPEN_DEBOUNCE_MS` AND the tile holds one of the `PREVIEW_AUTO_MAX_CONCURRENT`
 * slots; `false` the moment either condition fails or the slot is given up (a waiter takes the next
 * released slot as soon as one frees). The debounce runs on the page's timers, so a test drives it
 * with `pageTimersFake` / `pass`.
 */
export function useAutoPreviewOpen(eligible: boolean): boolean {
  const visible = useDocumentVisible()
  const open = eligible && visible
  const [debounced, setDebounced] = useState(false)
  useEffect(() => {
    if (!open) {
      setDebounced(false)
      return undefined
    }
    const timer = setTimeout(() => setDebounced(true), PREVIEW_AUTO_OPEN_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [open])
  const [hasSlot, setHasSlot] = useState(false)
  useEffect(() => {
    if (!debounced) {
      setHasSlot(false)
      return undefined
    }
    let held = false
    const tryClaim = () => {
      if (held) return
      if (claimPreviewSlot()) {
        held = true
        setHasSlot(true)
      } else {
        setHasSlot(false)
      }
    }
    tryClaim()
    const unsubscribe = subscribePreviewSlots(tryClaim)
    return () => {
      unsubscribe()
      if (held) {
        held = false
        releasePreviewSlot()
      }
    }
  }, [debounced])
  return debounced && hasSlot
}
