/**
 * The signed media session of operation 88 `createEvidenceMediaSession` on the tablet and the
 * phone (blueprint row 92, M8-W3; UX spec flow 5 steps 2 and 3, §6.6 "expo-video with headers";
 * API contract C3 §2.4; security review SEC35-12, SEC35-13; register E-31; the client contract of
 * row 90, `implementation/43_m8_media_stream.md` §2, §7).
 *
 * **The path is a bearer value.** Whoever holds it (with the operator's session) can read the
 * decrypted camera file until it expires. In this app it lives in exactly two places: inside a
 * `MediaSession` object held in the state of the open player, and in the source handed to that
 * player. It is NEVER put in a query key or the query cache (the session is not fetched through
 * the query client), a log record, an error, a toast, a route parameter or any storage: a failure
 * carries the status and the codes of the Core's envelope, and `MediaSession` prints as
 * `[media session VIDEO-01]` and serialises without its path (`media-session-canary.test.tsx`).
 *
 * | Rule | How |
 * |------|-----|
 * | Only the PATH of the answered `url` is used (`/media/mts_…`), resolved against this app's own Core address | `mediaPathOf`, `videoSourceOf` |
 * | The media route asks for the operator: the player sends `Authorization: Bearer <session token>` | `MediaTransport.headers`, supplied by the runtime: `mediaTransportOf` reads `mediaTransport()` of the Live source (integration pass D5; `runtime/sim-adapters.ts`). It answers null while no operator session is in memory — the player then says playback cannot be opened, and asks nothing of the Core |
 * | One session per camera file: the body `{ fileId }` | `requestMediaSession`; a registry that does not know the member yet makes the typed client refuse the body, and the request is sent without one (the Core opens VIDEO-01) |
 * | The token lives 60 s; a new range request after it is refused | `mediaSessionStale`: the player renews before it starts or seeks on a stale session, and once after a player error |
 * | A fragment that fails its tag: `409 MEDIA_NOT_AVAILABLE`, `details { reason: FRAGMENT_NOT_AUTHENTIC, fileId, seq }` | the refusal `INTEGRITY`: an integrity failure of the recording, never a player error |
 *
 * LIVE only: outside Live mode the app plays the bundled demo media and opens no media session.
 */
import type { MobileLiveSim } from '@/runtime';
import { CAMERA_FILE_IDS, type CameraFileId } from './item-v2';

/** What this screen keeps of a failed call: the Core's envelope (it holds no request and no path). */
export interface CoreFailure {
  readonly status: number | null;
  readonly error: { readonly code: string; readonly details?: unknown };
}

const PATH_SLOT = new WeakMap<MediaSession, string>();

/** One opened media session. Its path is reachable only through `takePath()`. */
export class MediaSession {
  readonly fileId: CameraFileId;
  /** The Core instant the path dies. */
  readonly expiresAt: number;

  constructor(fileId: CameraFileId, path: string, expiresAt: number) {
    this.fileId = fileId;
    this.expiresAt = expiresAt;
    PATH_SLOT.set(this, path);
  }

  /** The bearer path, for the source of the player and for nothing else. */
  takePath(): string {
    return PATH_SLOT.get(this) ?? '';
  }

  toJSON(): { fileId: CameraFileId; expiresAt: number } {
    return { fileId: this.fileId, expiresAt: this.expiresAt };
  }

  toString(): string {
    return `[media session ${this.fileId}]`;
  }
}

export type MediaSessionRefusal = 'NOT_AVAILABLE' | 'INTEGRITY' | 'NOT_PERMITTED' | 'FAILED';

export interface MediaSessionFailure {
  readonly ok: false;
  readonly refusal: MediaSessionRefusal;
  readonly status: number | null;
  readonly code: string;
  /** The file and the fragment an INTEGRITY refusal names, as far as it names them. */
  readonly integrity: { readonly fileId: string | null; readonly seq: number | null } | null;
  /** The failed call (the Core's envelope; it holds no path), for the presenter. null: the answer was not a usable session. */
  readonly failure: CoreFailure | null;
}

export type MediaSessionAnswer = { readonly ok: true; readonly session: MediaSession } | MediaSessionFailure;

const isCameraFile = (value: unknown): value is CameraFileId => (CAMERA_FILE_IDS as readonly unknown[]).includes(value);
const MEDIA_PATH = /^https?:\/\/[^/?#]+(\/media\/mts_[A-Za-z0-9_-]+)$/;

/** The path of the media route in an answered URL (`/media/mts_…`), or null for anything else. The host of the URL is never used. */
export function mediaPathOf(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  return MEDIA_PATH.exec(url)?.[1] ?? null;
}

/** What a 409 says of a failed fragment, or null. */
export function integrityOf(status: number | null, code: string, details: unknown): MediaSessionFailure['integrity'] {
  const record = (typeof details === 'object' && details !== null ? details : {}) as { reason?: unknown; fileId?: unknown; seq?: unknown };
  if (status !== 409 || code !== 'MEDIA_NOT_AVAILABLE' || record.reason !== 'FRAGMENT_NOT_AUTHENTIC') return null;
  return { fileId: isCameraFile(record.fileId) ? record.fileId : null, seq: typeof record.seq === 'number' && Number.isInteger(record.seq) && record.seq >= 0 ? record.seq : null };
}

type SessionCall = ReturnType<MobileLiveSim['client']['call']>;

/** The call with `{ fileId }`; without a body when the registry of this build does not know the member yet. */
async function callForFile(live: MobileLiveSim, evidenceId: string, fileId: CameraFileId) {
  const client = live.client as unknown as { call(operationId: 'createEvidenceMediaSession', input: { params: { id: string }; body?: { fileId: CameraFileId } }): SessionCall };
  try {
    return await client.call('createEvidenceMediaSession', { params: { id: evidenceId }, body: { fileId } });
  } catch (error) {
    // The typed client's own refusal of a body its registry does not know (`CoreClientUsageError`), told by its name.
    if (!(error instanceof Error && error.name === 'CoreClientUsageError')) throw error;
    return await live.client.call('createEvidenceMediaSession', { params: { id: evidenceId } });
  }
}

/** Operation 88 for one camera file. ONE request; nothing here repeats it. The answer says which file it opened. */
export async function requestMediaSession(live: MobileLiveSim, evidenceId: string, fileId: CameraFileId): Promise<MediaSessionAnswer> {
  const answer = await callForFile(live, evidenceId, fileId);
  if (!answer.ok) {
    const integrity = integrityOf(answer.status, answer.error.code, answer.error.details);
    const refusal: MediaSessionRefusal =
      integrity !== null ? 'INTEGRITY' : answer.status === 409 && answer.error.code === 'MEDIA_NOT_AVAILABLE' ? 'NOT_AVAILABLE' : answer.status === 403 ? 'NOT_PERMITTED' : 'FAILED';
    return { ok: false, refusal, status: answer.status, code: answer.error.code, integrity, failure: answer };
  }
  const data = answer.data as { fileId?: unknown; url?: unknown; expiresAt?: unknown };
  const path = mediaPathOf(data.url);
  if (!isCameraFile(data.fileId) || path === null || typeof data.expiresAt !== 'number') {
    return { ok: false, refusal: 'FAILED', status: answer.status, code: 'MEDIA_SESSION_UNUSABLE', integrity: null, failure: null };
  }
  return { ok: true, session: new MediaSession(data.fileId, path, data.expiresAt) };
}

export type MediaSessions = Partial<Record<CameraFileId, MediaSession>>;

export interface OpenedMediaSessions {
  /** One session per camera file the Core opened. */
  readonly sessions: MediaSessions;
  /** Why nothing, or not everything, was opened; null when both files are open. */
  readonly failure: MediaSessionFailure | null;
}

/**
 * Opens the sessions of both camera files: one request per file, at most two in all. A failed
 * first request ends it. When the second answer names the file already open, that file keeps its
 * first session and the other file stays closed.
 */
export async function openMediaSessions(live: MobileLiveSim, evidenceId: string): Promise<OpenedMediaSessions> {
  const sessions: MediaSessions = {};
  for (const fileId of CAMERA_FILE_IDS) {
    const answer = await requestMediaSession(live, evidenceId, fileId);
    if (!answer.ok) return { sessions, failure: answer };
    sessions[answer.session.fileId] ??= answer.session;
  }
  return { sessions, failure: null };
}

/** A session is renewed this long before its end, so a request that starts now is still answered. */
export const MEDIA_SESSION_RENEW_MARGIN_MS = 5_000;

/** Whether a NEW request on this session would be refused (or is about to be). */
export function mediaSessionStale(session: Pick<MediaSession, 'expiresAt'>, coreNow: number, marginMs: number = MEDIA_SESSION_RENEW_MARGIN_MS): boolean {
  return coreNow >= session.expiresAt - marginMs;
}

/** Where this app reaches its Core, and the header that names the operator to it. Held by the runtime, never by a screen. */
export interface MediaTransport {
  readonly origin: string;
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * The media transport of the Live source, or null (no Live source, no operator session, or an
 * answer that is not an origin with an `Authorization` header: read defensively, never trusted).
 */
export function mediaTransportOf(live: MobileLiveSim | null): MediaTransport | null {
  const provider = (live as { mediaTransport?: unknown } | null)?.mediaTransport;
  if (typeof provider !== 'function') return null;
  const transport = (provider as () => unknown).call(live) as Partial<MediaTransport> | null;
  if (transport === null || typeof transport !== 'object' || typeof transport.origin !== 'string' || !/^https?:\/\/[^/?#]+$/.test(transport.origin)) return null;
  if (typeof transport.headers !== 'object' || transport.headers === null || typeof transport.headers.Authorization !== 'string') return null;
  return { origin: transport.origin, headers: transport.headers };
}

/** The player source of a session: the Core's own address, the session's path, the operator's header. Built at the hand-over, kept nowhere. */
export function videoSourceOf(session: MediaSession, transport: MediaTransport): { uri: string; headers: Record<string, string> } {
  return { uri: `${transport.origin}${session.takePath()}`, headers: { ...transport.headers } };
}
