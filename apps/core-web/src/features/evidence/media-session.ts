/**
 * The signed media session of operation 88 `createEvidenceMediaSession` (blueprint row 92, M8-W3;
 * UX spec flow 5 steps 2 and 3; API contract C3 §2.4 "Media (88)"; security review SEC35-12,
 * SEC35-13; register E-31).
 *
 * **The URL is a bearer value.** Whoever holds it can read the decrypted camera file until it
 * expires. So in this console it lives in exactly two places: inside a `MediaSession` object held
 * in the state of the open player, and in the `src` of that player's media element (a media
 * element cannot be given a URL any other way). It is NEVER put in
 *
 * - a query key or the query cache (the session is not fetched through the query client at all),
 * - a log record, an error, a toast or a thrown message (a failure carries the status and the codes
 *   of the Core's envelope; `MediaSession` prints as `[media session VIDEO-01]` and serialises
 *   without its URL),
 * - the page address, the history, or `localStorage` / `sessionStorage`.
 *
 * `__tests__/media-session-canary.test.tsx` holds this with a canary token.
 *
 * LIVE only: Simulated mode plays the bundled demo media and opens no media session (NM-11).
 *
 * The client contract of the media route (row 90, `implementation/43_m8_media_stream.md` §2, §7):
 *
 * | Rule | How |
 * |------|-----|
 * | Only the PATH of the answered `url` is used (`/media/mts_…`), resolved against this console's own origin | `mediaPathOf`: the media route asks for the operator's session cookie, so the request must be same-origin (dev: the `/media` entry of the Vite proxy) |
 * | One session per camera file: the body `{ fileId }` | `requestMediaSession`. The member is being added to the contract (optional); a registry that does not know it yet makes the typed client refuse the body, and the request is then sent without one (the Core opens VIDEO-01) |
 * | The token lives 60 s; an answer in flight is not cut, every NEW range request after it is refused | `mediaSessionStale`: the player renews before it seeks or starts on a stale session, and after a media error |
 * | A fragment that fails its tag is refused by the MEDIA ROUTE (`409`, read by the media element, which cannot read a body) | Operation 88 opens no fragment and never answers it (review finding R93-12): this file reads no such refusal. The player stops at the place and points to Verify |
 * | A package of ONE camera has one file | `openMediaSessions(…, fileIds)`: only the files the item names are asked for; `409 … CAMERA_FILE_NOT_IN_PACKAGE` for the other is not a failure |
 * | Wave K (G94b-02): a file that does not load, or stops, is ASKED ABOUT | `probeMediaSession`: the one other reader of the bearer path. The media element cannot read the route's `409`; this request can, and it returns only the Core's codes (`reason`, `fileId`, `seq`) - never the path, never a byte of media |
 */
import type { WebLive } from '@/runtime'
import { CAMERA_FILE_IDS, type CameraFileId } from './item-v2'

/** What this page keeps of a failed call: the Core's envelope (it holds no request and no URL). The presenter takes it as it is. */
export interface CoreFailure {
  readonly status: number | null
  readonly error: { readonly code: string; readonly details?: unknown }
}

const URL_SLOT = new WeakMap<MediaSession, string>()

/** One opened media session. Its URL is reachable only through `takeUrl()`. */
export class MediaSession {
  readonly fileId: CameraFileId
  /** The Core instant the URL dies. */
  readonly expiresAt: number

  /** `path`: the same-origin path of the media route (`mediaPathOf`). */
  constructor(fileId: CameraFileId, path: string, expiresAt: number) {
    this.fileId = fileId
    this.expiresAt = expiresAt
    URL_SLOT.set(this, path)
  }

  /** The bearer path, for the `src` of the media element and for nothing else. */
  takeUrl(): string {
    return URL_SLOT.get(this) ?? ''
  }

  toJSON(): { fileId: CameraFileId; expiresAt: number } {
    return { fileId: this.fileId, expiresAt: this.expiresAt }
  }

  toString(): string {
    return `[media session ${this.fileId}]`
  }
}

export type MediaSessionRefusal =
  /** `409 MEDIA_NOT_AVAILABLE`: a fixed message, no player (UX §6.5). */
  | 'NOT_AVAILABLE'
  /** `403`. */
  | 'NOT_PERMITTED'
  /** Anything else: an outage, a time-out, a 404, an answer that is not a session. */
  | 'FAILED'

export interface MediaSessionFailure {
  readonly ok: false
  readonly refusal: MediaSessionRefusal
  readonly status: number | null
  readonly code: string
  /** The failed call (the Core's envelope; it holds no URL), for the presenter. null: the answer was not a usable session. */
  readonly failure: CoreFailure | null
}

export type MediaSessionAnswer = { readonly ok: true; readonly session: MediaSession } | MediaSessionFailure

const isCameraFile = (value: unknown): value is CameraFileId => (CAMERA_FILE_IDS as readonly unknown[]).includes(value)

/** The path of the media route in an answered URL (`/media/mts_…`), or null for anything else. The host of the URL is never used. */
export function mediaPathOf(url: unknown): string | null {
  if (typeof url !== 'string') return null
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  return /^\/media\/mts_[A-Za-z0-9_-]+$/.test(parsed.pathname) && parsed.search === '' && parsed.hash === '' ? parsed.pathname : null
}

/** `details.reason` of the 409 for a camera file the sealed package does not hold (a package of one camera). */
export const CAMERA_FILE_NOT_IN_PACKAGE = 'CAMERA_FILE_NOT_IN_PACKAGE'

/** The camera files an item names (`files[]` of 1 or 2), in file order; both when the item names none. */
export function cameraFilesOf(item: { readonly files: readonly { readonly trackId: string }[] }): readonly CameraFileId[] {
  const named = CAMERA_FILE_IDS.filter((fileId) => item.files.some((file) => file.trackId === fileId))
  return named.length > 0 ? named : CAMERA_FILE_IDS
}

type SessionCall = ReturnType<WebLive['client']['call']>

/** The call with `{ fileId }`; without a body when the registry of this build does not know the member yet. */
async function callForFile(live: WebLive, evidenceId: string, fileId: CameraFileId) {
  const client = live.client as unknown as { call(operationId: 'createEvidenceMediaSession', input: { params: { id: string }; body?: { fileId: CameraFileId } }): SessionCall }
  try {
    return await client.call('createEvidenceMediaSession', { params: { id: evidenceId }, body: { fileId } })
  } catch (error) {
    // The typed client's own refusal of a body its registry does not know (`CoreClientUsageError`), told by its name:
    // this folder loads no module of the client (MD-6).
    if (!(error instanceof Error && error.name === 'CoreClientUsageError')) throw error
    return await live.client.call('createEvidenceMediaSession', { params: { id: evidenceId } })
  }
}

/** Operation 88 for one camera file. ONE request; nothing here repeats it. The answer says which file it opened. */
export async function requestMediaSession(live: WebLive, evidenceId: string, fileId: CameraFileId): Promise<MediaSessionAnswer> {
  const answer = await callForFile(live, evidenceId, fileId)
  if (!answer.ok) {
    const refusal: MediaSessionRefusal = answer.status === 409 && answer.error.code === 'MEDIA_NOT_AVAILABLE' ? 'NOT_AVAILABLE' : answer.status === 403 ? 'NOT_PERMITTED' : 'FAILED'
    return { ok: false, refusal, status: answer.status, code: answer.error.code, failure: answer }
  }
  const data = answer.data as { fileId?: unknown; url?: unknown; expiresAt?: unknown }
  const path = mediaPathOf(data.url)
  if (!isCameraFile(data.fileId) || path === null || typeof data.expiresAt !== 'number') {
    return { ok: false, refusal: 'FAILED', status: answer.status, code: 'MEDIA_SESSION_UNUSABLE', failure: null }
  }
  return { ok: true, session: new MediaSession(data.fileId, path, data.expiresAt) }
}

export interface OpenedMediaSessions {
  /** One session per camera file the Core opened. */
  readonly sessions: Partial<Record<CameraFileId, MediaSession>>
  /** Why nothing, or not everything, was opened; null when both files are open. */
  readonly failure: MediaSessionFailure | null
}

/**
 * Opens the sessions of the camera files of an item (one or two): one request per file. A failed
 * first request ends it (no second request after a refusal). When the second answer names the
 * file already open, that file keeps its first session and the other file stays closed.
 */
export async function openMediaSessions(live: WebLive, evidenceId: string, fileIds: readonly CameraFileId[] = CAMERA_FILE_IDS): Promise<OpenedMediaSessions> {
  const sessions: Partial<Record<CameraFileId, MediaSession>> = {}
  for (const fileId of fileIds) {
    const answer = await requestMediaSession(live, evidenceId, fileId)
    if (!answer.ok) {
      // A package of one camera: the file that is not in it is no failure of the one that is.
      const reason = (answer.failure?.error.details as { reason?: unknown } | undefined)?.reason
      if (answer.status === 409 && reason === CAMERA_FILE_NOT_IN_PACKAGE && Object.keys(sessions).length > 0) continue
      return { sessions, failure: answer }
    }
    sessions[answer.session.fileId] ??= answer.session
  }
  return { sessions, failure: null }
}

/** A session is renewed this long before its end, so a request that starts now is still answered. */
export const MEDIA_SESSION_RENEW_MARGIN_MS = 5_000

/** Whether a NEW request on this session would be refused (or is about to be): its end, less the margin, has passed on the Core's clock. */
export function mediaSessionStale(session: Pick<MediaSession, 'expiresAt'>, coreNow: number, marginMs: number = MEDIA_SESSION_RENEW_MARGIN_MS): boolean {
  return coreNow >= session.expiresAt - marginMs
}

/** `details.reason` of the media route's `409` for a fragment whose bytes do not authenticate (`apps/core-server/src/media-stream/service.ts`). */
export const FRAGMENT_NOT_AUTHENTIC = 'FRAGMENT_NOT_AUTHENTIC'

/**
 * What the Core's media route says about one camera file from a place on (wave K, G94b-02).
 *
 * | Kind | The Core's answer |
 * |------|-------------------|
 * | `NOT_AUTHENTIC` | `409 MEDIA_NOT_AVAILABLE`, `details.reason: FRAGMENT_NOT_AUTHENTIC`, with the file and the fragment it names. An integrity failure of the sealed package |
 * | `REFUSED` | Any other refusal (the session ended, the package is gone, the role changed): its status and its reason code |
 * | `SERVED` | The bytes are served from that place, as far as this probe read |
 * | `UNKNOWN` | No answer could be read (no network, a time-out, an answer that is not the route's) |
 */
export type MediaProbeOutcome =
  | { readonly kind: 'NOT_AUTHENTIC'; readonly fileId: string; readonly seq: number | null }
  | { readonly kind: 'REFUSED'; readonly status: number; readonly reason: string | null }
  | { readonly kind: 'SERVED' }
  | { readonly kind: 'UNKNOWN' }

export interface MediaProbeOptions {
  /** The first byte asked for (the plaintext offset of the camera file). */
  readonly startByte?: number
  /** The probe stops reading after this many bytes: what it read was served. */
  readonly maxBytes?: number
  /** The probe gives up after this long. */
  readonly timeoutMs?: number
  readonly fetch?: typeof fetch
}

export const MEDIA_PROBE_MAX_BYTES = 16 * 1024 * 1024
export const MEDIA_PROBE_TIMEOUT_MS = 10_000
/** One streamed read, then the request from the place where it was cut; a cut answer is followed at most three times. */
const MEDIA_PROBE_MAX_REQUESTS = 4

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Reads the refusal of the media route: the codes of the Core's envelope and nothing else. */
async function refusalOf(response: Response, fileId: CameraFileId): Promise<MediaProbeOutcome> {
  let details: Record<string, unknown> = {}
  try {
    const body: unknown = await response.json()
    const error = isObject(body) ? body.error : null
    if (isObject(error) && isObject(error.details)) details = error.details
  } catch {
    // Not the route's envelope: the status alone is kept.
  }
  const reason = typeof details.reason === 'string' && details.reason.length <= 64 ? details.reason : null
  if (response.status === 409 && reason === FRAGMENT_NOT_AUTHENTIC) {
    const named = typeof details.fileId === 'string' && /^[A-Z]+-\d{2}$/.test(details.fileId) ? details.fileId : fileId
    const seq = typeof details.seq === 'number' && Number.isInteger(details.seq) && details.seq >= 0 ? details.seq : null
    return { kind: 'NOT_AUTHENTIC', fileId: named, seq }
  }
  return { kind: 'REFUSED', status: response.status, reason }
}

/** Reads a served body and counts it. `cut`: the answer ended before the length the Core stated (the stream was stopped). */
async function drain(response: Response, maxBytes: number): Promise<{ readonly received: number; readonly cut: boolean }> {
  const declared = Number(response.headers.get('content-length'))
  const reader = response.body?.getReader()
  let received = 0
  if (!reader) return { received, cut: false }
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received >= maxBytes) {
        void reader.cancel().catch(() => undefined)
        return { received, cut: false }
      }
    }
  } catch {
    // A connection the Core closed before the stated length: the browser rejects the read.
    return { received, cut: true }
  }
  return { received, cut: Number.isFinite(declared) && declared > 0 && received < declared }
}

/**
 * Asks the media route about one open session from `startByte` on (wave K, G94b-02): a media
 * element that stalls says nothing, and it cannot read the body of a refusal. The Core stops a
 * stream BEFORE a fragment that does not authenticate and answers a range that STARTS in it with
 * `409` naming the file and the fragment. So: read from the start; where the answer is cut, ask
 * again from that byte. Same-origin, with the operator's session cookie, never cached.
 *
 * The bearer path goes from the session to the request and nowhere else; the outcome holds codes
 * only. Never throws. Each request is one the Core records, as the media element's own are.
 */
export async function probeMediaSession(session: MediaSession, options: MediaProbeOptions = {}): Promise<MediaProbeOutcome> {
  const ask = options.fetch ?? (typeof fetch === 'function' ? fetch : null)
  const path = session.takeUrl()
  if (ask === null || path === '') return { kind: 'UNKNOWN' }
  const maxBytes = options.maxBytes ?? MEDIA_PROBE_MAX_BYTES
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? MEDIA_PROBE_TIMEOUT_MS)
  let offset = Math.max(0, Math.floor(options.startByte ?? 0))
  let read = 0
  try {
    for (let request = 0; request < MEDIA_PROBE_MAX_REQUESTS; request += 1) {
      const response = await ask(path, { method: 'GET', headers: { range: `bytes=${offset}-` }, credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      // A range that starts at or past the end of the file: nothing is wrong at that place.
      if (response.status === 416) return { kind: 'SERVED' }
      if (response.status !== 200 && response.status !== 206) return await refusalOf(response, session.fileId)
      const { received, cut } = await drain(response, maxBytes - read)
      read += received
      if (!cut || read >= maxBytes) return { kind: 'SERVED' }
      offset += received
    }
    return { kind: 'UNKNOWN' }
  } catch {
    return { kind: 'UNKNOWN' }
  } finally {
    clearTimeout(timer)
  }
}
