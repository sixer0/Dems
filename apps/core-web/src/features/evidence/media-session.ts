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
 * | A fragment that fails its tag: `409 MEDIA_NOT_AVAILABLE`, `details { reason: FRAGMENT_NOT_AUTHENTIC, fileId, seq }` | `integrityOf`: the refusal `INTEGRITY` with the file and the fragment — an integrity failure of the recording, never a player error |
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
  /** `409 MEDIA_NOT_AVAILABLE` with `details.reason: FRAGMENT_NOT_AUTHENTIC`: the recording failed its integrity check. */
  | 'INTEGRITY'
  /** `403`. */
  | 'NOT_PERMITTED'
  /** Anything else: an outage, a time-out, a 404, an answer that is not a session. */
  | 'FAILED'

export interface MediaSessionFailure {
  readonly ok: false
  readonly refusal: MediaSessionRefusal
  readonly status: number | null
  readonly code: string
  /** The file and the fragment an INTEGRITY refusal names, as far as it names them. */
  readonly integrity: { readonly fileId: string | null; readonly seq: number | null } | null
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

/** What a 409 says of a failed fragment, or null. */
export function integrityOf(status: number | null, code: string, details: unknown): MediaSessionFailure['integrity'] {
  const record = (typeof details === 'object' && details !== null ? details : {}) as { reason?: unknown; fileId?: unknown; seq?: unknown }
  if (status !== 409 || code !== 'MEDIA_NOT_AVAILABLE' || record.reason !== 'FRAGMENT_NOT_AUTHENTIC') return null
  return { fileId: isCameraFile(record.fileId) ? record.fileId : null, seq: typeof record.seq === 'number' && Number.isInteger(record.seq) && record.seq >= 0 ? record.seq : null }
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
    const integrity = integrityOf(answer.status, answer.error.code, answer.error.details)
    const refusal: MediaSessionRefusal =
      integrity !== null ? 'INTEGRITY' : answer.status === 409 && answer.error.code === 'MEDIA_NOT_AVAILABLE' ? 'NOT_AVAILABLE' : answer.status === 403 ? 'NOT_PERMITTED' : 'FAILED'
    return { ok: false, refusal, status: answer.status, code: answer.error.code, integrity, failure: answer }
  }
  const data = answer.data as { fileId?: unknown; url?: unknown; expiresAt?: unknown }
  const path = mediaPathOf(data.url)
  if (!isCameraFile(data.fileId) || path === null || typeof data.expiresAt !== 'number') {
    return { ok: false, refusal: 'FAILED', status: answer.status, code: 'MEDIA_SESSION_UNUSABLE', integrity: null, failure: null }
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
 * Opens the sessions of both camera files: one request per file, at most two in all. A failed
 * first request ends it (no second request after a refusal). When the second answer names the
 * file already open, that file keeps its first session and the other file stays closed.
 */
export async function openMediaSessions(live: WebLive, evidenceId: string): Promise<OpenedMediaSessions> {
  const sessions: Partial<Record<CameraFileId, MediaSession>> = {}
  for (const fileId of CAMERA_FILE_IDS) {
    const answer = await requestMediaSession(live, evidenceId, fileId)
    if (!answer.ok) return { sessions, failure: answer }
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
