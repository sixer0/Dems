// Row 195 (M3-09 R1, R3-R5; renderer D202): the pure parts and the stream of the tablet's live camera preview.
// `expo/fetch` is stood in for by a controllable fake; the framing below is the one the Core writes
// (`apps/core-server/src/camera-preview/service.ts`: `--<boundary>\r\nContent-Type: image/jpeg\r\nContent-Length: N\r\n\r\n<jpeg>\r\n`).
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import type { MobileLiveSim } from '@/runtime';
import {
  CAMERA_STREAMS_MAX,
  MJPEG_MAX_BUFFER_BYTES,
  cameraPreviewRefusalOf,
  cameraStreamsHeld,
  createMjpegPartCutter,
  jpegFrameUriOf,
  mjpegBoundaryOf,
  openCameraPreviewSession,
  previewStreamPathOf,
  resetCameraStreamClaims,
  streamCameraPreview,
  useCameraStreamClaim,
} from './camera-live-stream';

const mockStreamFetch = jest.fn<(url: string, init: { headers: Record<string, string>; credentials: string; signal: AbortSignal; method: string }) => Promise<unknown>>();
jest.mock('expo/fetch', () => ({ fetch: (...args: unknown[]) => (mockStreamFetch as unknown as (...a: unknown[]) => unknown)(...args) }));

const BOUNDARY = 'demsframe';
const TOKEN = `cps_${'A'.repeat(20)}MARKER${'b'.repeat(17)}`;
const PATH = `/preview/${TOKEN}`;
const ORIGIN = 'http://127.0.0.1:4420';
const SESSION = 'sess-SECRET-MARKER';

const enc = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
const jpeg = (n: number): Uint8Array => Uint8Array.from([0xff, 0xd8, n, n + 1, 0xff, 0xd9]);
function part(body: Uint8Array): Uint8Array {
  const head = enc(`--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${body.length}\r\n\r\n`);
  const all = new Uint8Array(head.length + body.length + 2);
  all.set(head);
  all.set(body, head.length);
  all.set(enc('\r\n'), head.length + body.length);
  return all;
}
const concat = (...chunks: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
};

function liveWith(call?: (...args: unknown[]) => Promise<unknown>, signedIn = true): MobileLiveSim {
  const transport = { origin: ORIGIN } as { origin: string; headers: Record<string, string> };
  Object.defineProperty(transport, 'headers', { value: Object.freeze({ Authorization: `Bearer ${SESSION}` }), enumerable: false });
  return { client: { call: call ?? (async () => ({ ok: false, status: 503, error: { code: 'NOT_READY' } })) }, mediaTransport: () => (signedIn ? transport : null) } as unknown as MobileLiveSim;
}

/** A response whose body yields the pushed chunks and rejects its pending read on abort, like expo/fetch. */
function fakeResponse(status: number, signal: AbortSignal, contentType = `multipart/x-mixed-replace; boundary=${BOUNDARY}`) {
  const queue: Uint8Array[] = [];
  let waiting: { resolve: (r: { value?: Uint8Array; done: boolean }) => void; reject: (e: Error) => void } | null = null;
  let finished = false;
  const abortError = () => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
  signal.addEventListener('abort', () => waiting?.reject(abortError()));
  const reader = {
    read: () => {
      if (signal.aborted) return Promise.reject(abortError());
      const next = queue.shift();
      if (next !== undefined) return Promise.resolve({ value: next, done: false });
      if (finished) return Promise.resolve({ done: true });
      return new Promise<{ value?: Uint8Array; done: boolean }>((resolve, reject) => {
        waiting = { resolve, reject };
      });
    },
    cancel: async () => undefined,
  };
  return {
    response: { ok: status >= 200 && status < 300, status, headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) }, body: { getReader: () => reader, cancel: async () => undefined } },
    push(chunk: Uint8Array) {
      const w = waiting;
      waiting = null;
      if (w !== null) w.resolve({ value: chunk, done: false });
      else queue.push(chunk);
    },
    end() {
      finished = true;
      const w = waiting;
      waiting = null;
      w?.resolve({ done: true });
    },
  };
}

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

afterEach(() => {
  mockStreamFetch.mockReset();
  resetCameraStreamClaims();
});

describe('the pure rules', () => {
  it('refusals: 409, 429, 401, 403 by status; anything else FAILED', () => {
    expect([409, 429, 401, 403, 500, 404, null].map(cameraPreviewRefusalOf)).toEqual(['NOT_AVAILABLE', 'LIMIT', 'NOT_SIGNED_IN', 'NOT_PERMITTED', 'FAILED', 'FAILED', 'FAILED']);
  });

  it('only the path of a preview URL is used; anything else is no stream', () => {
    expect(previewStreamPathOf(`http://127.0.0.1:4420${PATH}`)).toBe(PATH);
    expect(previewStreamPathOf(`http://127.0.0.1${PATH}`)).toBe(PATH);
    for (const bad of [`http://127.0.0.1:4420${PATH}?x=1`, `http://127.0.0.1:4420${PATH}#f`, 'http://127.0.0.1:4420/media/mts_x', `http://127.0.0.1:4420/preview/xyz_abc`, PATH, 42, null, undefined]) {
      expect([bad, previewStreamPathOf(bad)]).toEqual([bad, null]);
    }
  });

  it('the boundary of a multipart/x-mixed-replace type', () => {
    expect(mjpegBoundaryOf(`multipart/x-mixed-replace; boundary=${BOUNDARY}`)).toBe(BOUNDARY);
    expect(mjpegBoundaryOf(`multipart/x-mixed-replace;boundary="${BOUNDARY}"`)).toBe(BOUNDARY);
    expect(mjpegBoundaryOf('image/jpeg')).toBeNull();
    expect(mjpegBoundaryOf(null)).toBeNull();
  });

  it('a frame is a JPEG data URI', () => {
    expect(jpegFrameUriOf(jpeg(1))).toBe(`data:image/jpeg;base64,${btoa(String.fromCharCode(0xff, 0xd8, 1, 2, 0xff, 0xd9))}`);
  });
});

describe('the multipart cutter', () => {
  it('cuts whole parts in order, whatever the chunking (one chunk, byte by byte)', () => {
    const stream = concat(part(jpeg(1)), part(jpeg(2)), part(jpeg(3)));
    expect(createMjpegPartCutter(BOUNDARY)(stream).map((p) => p[2])).toEqual([1, 2, 3]);
    const cut = createMjpegPartCutter(BOUNDARY);
    const got: number[] = [];
    for (const byte of stream) for (const p of cut(Uint8Array.of(byte))) got.push(p[2] ?? -1);
    expect(got).toEqual([1, 2, 3]);
  });

  it('a part is given only once whole; a large part spanning chunks is kept', () => {
    const body = new Uint8Array(100_000).fill(7);
    body[0] = 0xff;
    body[1] = 0xd8;
    const whole = part(body);
    const cut = createMjpegPartCutter(BOUNDARY);
    expect(cut(whole.subarray(0, 50_000))).toEqual([]);
    const parts = cut(whole.subarray(50_000));
    expect(parts).toHaveLength(1);
    expect(parts[0]?.length).toBe(100_000);
  });

  it('a stream that is not the Core\'s framing breaks it instead of growing without end', () => {
    const cut = createMjpegPartCutter(BOUNDARY);
    expect(() => cut(enc(`--${BOUNDARY}\r\nContent-Length: ${MJPEG_MAX_BUFFER_BYTES + 1}\r\n\r\n`))).toThrow('MJPEG_PART_TOO_LARGE');
    // Junk without a boundary is not kept.
    const junk = createMjpegPartCutter(BOUNDARY);
    expect(junk(new Uint8Array(10_000).fill(65))).toEqual([]);
    expect(junk(part(jpeg(9))).map((p) => p[2])).toEqual([9]);
  });
});

describe('operation 112: one request, the path only', () => {
  it('asks once; a usable answer gives the path, never the host', async () => {
    const call = jest.fn(async () => ({ ok: true, status: 201, data: { url: `http://127.0.0.1:4420${PATH}`, expiresAt: 1 } }));
    expect(await openCameraPreviewSession(liveWith(call), 'CAM-07')).toEqual({ ok: true, path: PATH });
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith('createCameraPreviewSession', { params: { id: 'CAM-07' } });
  });

  it.each([
    [409, 'NOT_AVAILABLE'],
    [429, 'LIMIT'],
    [401, 'NOT_SIGNED_IN'],
    [403, 'NOT_PERMITTED'],
  ])('a %i refusal is said, not repeated', async (status, refusal) => {
    const call = jest.fn(async () => ({ ok: false, status, error: { code: 'X' } }));
    expect(await openCameraPreviewSession(liveWith(call), 'CAM-07')).toEqual({ ok: false, refusal, status, code: 'X' });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('an answer whose URL is no preview path is unusable', async () => {
    const call = jest.fn(async () => ({ ok: true, status: 201, data: { url: 'http://127.0.0.1:4420/elsewhere' } }));
    expect(await openCameraPreviewSession(liveWith(call), 'CAM-07')).toEqual({ ok: false, refusal: 'FAILED', status: 201, code: 'PREVIEW_SESSION_UNUSABLE' });
  });
});

describe('the stream (expo/fetch)', () => {
  it('carries the bearer header, no cookie, the app\'s own origin; frames flow; abort ends it quietly', async () => {
    const controller = new AbortController();
    const fake = fakeResponse(200, controller.signal);
    mockStreamFetch.mockResolvedValue(fake.response);
    const frames: string[] = [];
    const done = streamCameraPreview({ live: liveWith(), path: PATH, signal: controller.signal, onFrame: (uri) => frames.push(uri) });
    await flush();
    expect(mockStreamFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockStreamFetch.mock.calls[0]!;
    expect(url).toBe(`${ORIGIN}${PATH}`);
    expect(init.headers).toEqual({ Authorization: `Bearer ${SESSION}` });
    expect(init.credentials).toBe('omit');
    expect(init.method).toBe('GET');
    expect(init.signal).toBe(controller.signal);
    fake.push(concat(part(jpeg(1)), part(jpeg(2))));
    await flush();
    // Only the newest picture of a chunk is drawn.
    expect(frames).toEqual([jpegFrameUriOf(jpeg(2))]);
    controller.abort();
    expect(await done).toEqual({ kind: 'aborted' });
  });

  it.each([
    [401, 'NOT_SIGNED_IN'],
    [403, 'NOT_PERMITTED'],
    [409, 'NOT_AVAILABLE'],
    [429, 'LIMIT'],
  ])('a stream refused %i ends with that refusal', async (status, refusal) => {
    const controller = new AbortController();
    mockStreamFetch.mockResolvedValue(fakeResponse(status, controller.signal).response);
    expect(await streamCameraPreview({ live: liveWith(), path: PATH, signal: controller.signal, onFrame: () => undefined })).toEqual({ kind: 'refused', refusal, status, code: `STREAM_${status}` });
  });

  it('no operator session: nothing is asked', async () => {
    const end = await streamCameraPreview({ live: liveWith(undefined, false), path: PATH, signal: new AbortController().signal, onFrame: () => undefined });
    expect(end).toEqual({ kind: 'refused', refusal: 'NO_TRANSPORT', status: null, code: 'NO_TRANSPORT' });
    expect(mockStreamFetch).not.toHaveBeenCalled();
  });

  it('a stream the Core ends, or a transport error, is FAILED by name only (never its message)', async () => {
    const controller = new AbortController();
    const fake = fakeResponse(200, controller.signal);
    mockStreamFetch.mockResolvedValue(fake.response);
    const done = streamCameraPreview({ live: liveWith(), path: PATH, signal: controller.signal, onFrame: () => undefined });
    await flush();
    fake.end();
    expect(await done).toEqual({ kind: 'refused', refusal: 'FAILED', status: null, code: 'STREAM_ENDED' });
    mockStreamFetch.mockRejectedValue(Object.assign(new Error(`failed to connect to ${ORIGIN}${PATH}`), { name: 'TypeError' }));
    const failed = await streamCameraPreview({ live: liveWith(), path: PATH, signal: new AbortController().signal, onFrame: () => undefined });
    expect(failed).toEqual({ kind: 'refused', refusal: 'FAILED', status: null, code: 'STREAM_TypeError' });
    expect(JSON.stringify(failed)).not.toContain('MARKER');
  });
});

describe('P5: one stream per camera from this tablet, the Core\'s pipeline bound in all', () => {
  it('a second tile of the same camera waits, and takes the stream when the first lets go', () => {
    const first = renderHook(() => useCameraStreamClaim('CAM-07', true));
    const second = renderHook(() => useCameraStreamClaim('CAM-07', true));
    expect(first.result.current).toBe(true);
    expect(second.result.current).toBe(false);
    expect(cameraStreamsHeld()).toBe(1);
    act(() => first.unmount());
    expect(second.result.current).toBe(true);
    second.unmount();
    expect(cameraStreamsHeld()).toBe(0);
  });

  it('no more than CAMERA_STREAMS_MAX cameras at once; not wanting holds nothing', () => {
    const tiles = Array.from({ length: CAMERA_STREAMS_MAX + 1 }, (_, i) => renderHook(() => useCameraStreamClaim(`CAM-${String(i)}`, true)));
    expect(tiles.map((tile) => tile.result.current)).toEqual([...Array.from({ length: CAMERA_STREAMS_MAX }, () => true), false]);
    tiles.forEach((tile) => tile.unmount());
    const idle = renderHook(() => useCameraStreamClaim('CAM-1', false));
    expect(idle.result.current).toBe(false);
    expect(cameraStreamsHeld()).toBe(0);
    idle.unmount();
  });
});
