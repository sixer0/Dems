/**
 * The live camera preview stream of the tablet (task 2026-11-05 row 195, M3-09 R1, R3-R5; renderer chosen by
 * the spike of row 193, decision D202: option B = `expo/fetch` + this multipart cutter + `expo-image`).
 *
 * | Rule | Where |
 * |------|-------|
 * | Operation 112 `createCameraPreviewSession`, ONE request per call, never repeated here (the reach gate of row 194 decides every ask, retries included: D185) | `openCameraPreviewSession` |
 * | Only the PATH of the answered URL is used (`/preview/cps_…`), resolved against this app's own Core origin (the Core names its loopback address; the web does the same, `previewPathOf`) | `previewStreamPathOf` |
 * | The stream asks for the operator: `Authorization: Bearer <session token>` from the Live source's media transport, `credentials: 'omit'` (no cookie, D69 / F55). The request itself is the runtime's (`openCameraStream`, `runtime/camera-stream-transport.ts`, the D69 guard's named allowance, D217); this file only reads the body | `streamCameraPreview` |
 * | 409 / 429 / 401 / 403 (of op 112 or of the stream) end the preview: the caller shows the neutral tile and asks no more | `cameraPreviewRefusalOf` |
 * | The stream is `multipart/x-mixed-replace`; each part is cut by its `Content-Length`, the framing the Core writes (`apps/core-server/src/camera-preview/service.ts`) | `createMjpegPartCutter` |
 * | At most one stream per camera from this tablet, and at most the Core's pipeline bound in all (P5, `CAMERA_PREVIEW_LIMITS`) | `useCameraStreamClaim` |
 *
 * THE URL AND THE TOKEN ARE BEARER VALUES. Neither leaves this module except into the request itself: no
 * return value, error, log record or test id holds them. A failure carries the stage, the status and the
 * Core's error code only; an error thrown by the transport is told by its NAME, never its message (a native
 * message can quote the URL).
 */
import { useEffect, useState } from 'react';
import { CAMERA_PREVIEW_LIMITS, CAMERA_PREVIEW_TOKEN_PREFIX } from '@dems/shared/api';
import { cameraStreamTransportReady, openCameraStream, type MobileLiveSim } from '@/runtime';

/** Why a preview ended without a picture, or stopped showing one. */
export type CameraPreviewRefusal =
  /** 409 (`PREVIEW_NOT_AVAILABLE`, `AUTH_REFUSED`, a session opening the camera): no preview of this camera now. */
  | 'NOT_AVAILABLE'
  /** 429 (`PREVIEW_LIMIT`): the Core's bounds are full. */
  | 'LIMIT'
  /** 401: the Core does not know the session. */
  | 'NOT_SIGNED_IN'
  /** 403: the operator may not open it. */
  | 'NOT_PERMITTED'
  /** No operator session in memory: nothing is asked of the Core. */
  | 'NO_TRANSPORT'
  /** Any other status, no answer, an unusable answer, or a stream that broke or ended. */
  | 'FAILED';

/** What a status means for the preview; pure. */
export function cameraPreviewRefusalOf(status: number | null): CameraPreviewRefusal {
  if (status === 409) return 'NOT_AVAILABLE';
  if (status === 429) return 'LIMIT';
  if (status === 401) return 'NOT_SIGNED_IN';
  if (status === 403) return 'NOT_PERMITTED';
  return 'FAILED';
}

const STREAM_PATH = new RegExp(`^/preview/${CAMERA_PREVIEW_TOKEN_PREFIX}[A-Za-z0-9_-]+$`);

/** The path of the stream in an answered URL, or null for anything else. The URL's host is never used. */
export function previewStreamPathOf(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const match = /^https?:\/\/[^/?#]+(\/[^?#]*)$/.exec(url);
  return match !== null && STREAM_PATH.test(match[1] ?? '') ? (match[1] ?? null) : null;
}

/** The answer of op 112: the stream's path (a bearer value, handed to `streamCameraPreview` only), or why not. */
export type CameraPreviewSession =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly refusal: CameraPreviewRefusal; readonly status: number | null; readonly code: string };

/** Operation 112 for one camera. ONE request; nothing here repeats it. */
export async function openCameraPreviewSession(live: MobileLiveSim, deviceId: string): Promise<CameraPreviewSession> {
  const client = live.client as unknown as {
    call(operationId: 'createCameraPreviewSession', input: { params: { id: string } }): Promise<{ ok: true; status: number; data: unknown } | { ok: false; status: number | null; error: { code: string } }>;
  };
  const answer = await client.call('createCameraPreviewSession', { params: { id: deviceId } });
  if (!answer.ok) return { ok: false, refusal: cameraPreviewRefusalOf(answer.status), status: answer.status, code: answer.error.code };
  const path = previewStreamPathOf((answer.data as { url?: unknown } | null)?.url);
  return path === null ? { ok: false, refusal: 'FAILED', status: answer.status, code: 'PREVIEW_SESSION_UNUSABLE' } : { ok: true, path };
}

/** Whether an operator session is in memory to carry the stream (checked BEFORE op 112, so no session is opened for nothing). */
export function previewTransportReady(live: MobileLiveSim): boolean {
  return cameraStreamTransportReady(live);
}

// ── The multipart cutter ─────────────────────────────────────────────────────────────────────

/** A part bigger than this (or a buffer that grows past it without a whole part) breaks the stream. */
export const MJPEG_MAX_BUFFER_BYTES = 4 * 1024 * 1024;
const HEAD_WINDOW = 512;

const latin1 = (bytes: Uint8Array): string => {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return text;
};

/** The boundary named by a `multipart/x-mixed-replace` content type, or null. */
export function mjpegBoundaryOf(contentType: string | null | undefined): string | null {
  if (typeof contentType !== 'string' || !/^multipart\/x-mixed-replace\b/i.test(contentType.trim())) return null;
  const match = /boundary="?([^";]+)"?/i.exec(contentType);
  return match?.[1] ?? null;
}

/**
 * A cutter for one stream: give it each chunk, it returns the whole JPEG parts the chunk completed (in order).
 * A part is `--<boundary>`, headers with `Content-Length: N`, a blank line, then N bytes (its headers fit in
 * the first 512 bytes; the Core writes about 70). Throws when the
 * buffer passes `MJPEG_MAX_BUFFER_BYTES` (a stream that is not what the Core writes).
 */
export function createMjpegPartCutter(boundary: string): (chunk: Uint8Array) => Uint8Array[] {
  const marker = `--${boundary}`;
  let buffer = new Uint8Array(0);
  return (chunk) => {
    const joined = new Uint8Array(buffer.length + chunk.length);
    joined.set(buffer);
    joined.set(chunk, buffer.length);
    buffer = joined;
    const parts: Uint8Array[] = [];
    for (;;) {
      const head = latin1(buffer.subarray(0, Math.min(buffer.length, HEAD_WINDOW)));
      const at = head.indexOf(marker);
      if (at > 0) {
        // What stands before a boundary (the CRLF that ends the previous part) is dropped: a part starts at 0.
        buffer = buffer.slice(at);
        continue;
      }
      if (at < 0) {
        // No boundary in the window: keep only a tail that could be the start of one.
        if (buffer.length > HEAD_WINDOW) buffer = buffer.slice(buffer.length - marker.length);
        break;
      }
      const headEnd = head.indexOf('\r\n\r\n');
      if (headEnd < 0) break;
      const length = /content-length:\s*(\d+)/i.exec(head.slice(0, headEnd));
      if (length === null) {
        buffer = buffer.slice(headEnd + 4);
        continue;
      }
      const start = headEnd + 4;
      const end = start + Number(length[1]);
      if (end - start > MJPEG_MAX_BUFFER_BYTES) throw new Error('MJPEG_PART_TOO_LARGE');
      if (buffer.length < end) break;
      parts.push(buffer.slice(start, end));
      buffer = buffer.slice(end);
    }
    if (buffer.length > MJPEG_MAX_BUFFER_BYTES) throw new Error('MJPEG_BUFFER_OVERFLOW');
    return parts;
  };
}

/** A JPEG part as an image source for `expo-image` (a data URI; the spike decoded one natively). */
export function jpegFrameUriOf(jpeg: Uint8Array): string {
  return `data:image/jpeg;base64,${btoa(latin1(jpeg))}`;
}

const isJpeg = (part: Uint8Array): boolean => part.length > 2 && part[0] === 0xff && part[1] === 0xd8;

// ── The stream ───────────────────────────────────────────────────────────────────────────────

/** How a stream ended. `aborted`: the caller closed it (unmount, session end); nothing is to be said. */
export type CameraPreviewStreamEnd =
  | { readonly kind: 'aborted' }
  | { readonly kind: 'refused'; readonly refusal: CameraPreviewRefusal; readonly status: number | null; readonly code: string };

export interface StreamCameraPreviewInput {
  readonly live: MobileLiveSim;
  /** From `openCameraPreviewSession`; a bearer value. */
  readonly path: string;
  readonly signal: AbortSignal;
  /** Each whole JPEG part, as an image URI. */
  readonly onFrame: (uri: string) => void;
}

/**
 * Opens the stream of a preview session and hands on its frames until it ends or `signal` aborts. Resolves,
 * never rejects. The request carries the session header and no cookie.
 */
export async function streamCameraPreview({ live, path, signal, onFrame }: StreamCameraPreviewInput): Promise<CameraPreviewStreamEnd> {
  if (!cameraStreamTransportReady(live)) return { kind: 'refused', refusal: 'NO_TRANSPORT', status: null, code: 'NO_TRANSPORT' };
  const failed = (code: string, status: number | null = null): CameraPreviewStreamEnd => (signal.aborted ? { kind: 'aborted' } : { kind: 'refused', refusal: cameraPreviewRefusalOf(status), status, code });
  try {
    const response = await openCameraStream({ live, path, signal });
    if (response === null) return failed('NO_TRANSPORT');
    if (!response.ok) {
      try {
        await response.body?.cancel();
      } catch {
        // The refusal is already known; its body is not read.
      }
      return failed(`STREAM_${String(response.status)}`, response.status);
    }
    const boundary = mjpegBoundaryOf(response.contentType);
    const reader = response.body?.getReader();
    if (boundary === null || reader === undefined) {
      await reader?.cancel().catch(() => undefined);
      return failed('STREAM_NOT_MJPEG', response.status);
    }
    const cut = createMjpegPartCutter(boundary);
    for (;;) {
      const { value, done } = await reader.read();
      if (done || signal.aborted) break;
      let latest: Uint8Array | null = null;
      for (const part of cut(value)) if (isJpeg(part)) latest = part;
      // Only the newest picture of a chunk is drawn (the Core sends about 8 per second).
      if (latest !== null) onFrame(jpegFrameUriOf(latest));
    }
    return failed('STREAM_ENDED', null);
  } catch (error) {
    return failed(`STREAM_${error instanceof Error ? error.name : 'ERROR'}`, null);
  }
}

// ── P5: one stream per camera from this tablet, and no more than the Core's pipelines in all ─────────

/** At most this many streams from this tablet at once (the Core's own global bound; a further one would only collect 429). */
export const CAMERA_STREAMS_MAX = CAMERA_PREVIEW_LIMITS.pipelines;

const streamHolders = new Map<string, symbol>();
const streamWaiters = new Set<() => void>();

function tellStreamWaiters(): void {
  for (const waiter of [...streamWaiters]) waiter();
}

function claimCameraStream(deviceId: string, owner: symbol): boolean {
  const holder = streamHolders.get(deviceId);
  if (holder === owner) return true;
  if (holder !== undefined || streamHolders.size >= CAMERA_STREAMS_MAX) return false;
  streamHolders.set(deviceId, owner);
  return true;
}

function releaseCameraStream(deviceId: string, owner: symbol): void {
  if (streamHolders.get(deviceId) !== owner) return;
  streamHolders.delete(deviceId);
  tellStreamWaiters();
}

/** How many streams this tablet holds (tests). */
export function cameraStreamsHeld(): number {
  return streamHolders.size;
}

/** Every claim ends (test isolation). */
export function resetCameraStreamClaims(): void {
  streamHolders.clear();
  tellStreamWaiters();
}

/**
 * Whether this tile holds the one stream of `deviceId` while it `wants` one. A tile that finds the camera
 * held (another surface shows it) or the bound full waits, and takes the slot when one frees.
 */
export function useCameraStreamClaim(deviceId: string | null, wants: boolean): boolean {
  const [owner] = useState(() => Symbol('camera-stream'));
  const [held, setHeld] = useState<string | null>(null);
  useEffect(() => {
    if (!wants || deviceId === null) return undefined;
    const attempt = () => {
      if (claimCameraStream(deviceId, owner)) setHeld(deviceId);
    };
    attempt();
    streamWaiters.add(attempt);
    return () => {
      streamWaiters.delete(attempt);
      setHeld(null);
      releaseCameraStream(deviceId, owner);
    };
  }, [deviceId, wants, owner]);
  return wants && deviceId !== null && held === deviceId;
}
