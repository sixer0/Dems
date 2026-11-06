// Row 195 (M3-09 R1, R3-R5; renderer D202; gate D185): the tablet's live camera preview as a consumer mounts it,
// `<CameraPreview livePreview />` (row 196 turns it on at the four sites). A real test simulator holds the
// store; Live client mode, operation 112 and the operator's session are stood in for by `useMobileLive`
// (as camera-reach-gate.test.tsx); `expo/fetch` by a controllable stream.
//
// Every case captures EVERY runtime-log write and every console call, and checks at the end that neither the
// preview URL, its token nor the session token is in any of them (M3-09 R5).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import { CaptureDeviceReach } from '@dems/shared/api';
import { SimProvider, type SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { runtimeLog } from '@/runtime/log';
import { createTestSim, type TestSim } from '@/runtime/testing/test-sim';
import { CameraPreview, isSessionStarting } from './camera-preview';
import { resetCameraStreamClaims } from './camera-live-stream';
import { resetCameraPreviewRetries } from './camera-reach-gate';

const ORIGIN = 'http://127.0.0.1:4420';
const TOKEN = `cps_${'Q'.repeat(20)}PVMARKER${'z'.repeat(15)}`;
const URL_TEXT = `${ORIGIN}/preview/${TOKEN}`;
const SESSION = 'sess-SECRET-SESSIONMARKER';
const SECRETS = [TOKEN, URL_TEXT, SESSION, 'PVMARKER', 'SESSIONMARKER'];

type Answer = { ok: true; status: number; data: unknown } | { ok: false; status: number | null; error: { code: string } };
const op112 = jest.fn<(operationId: string, input: unknown) => Promise<Answer>>();
let endListeners: ((end: unknown) => void)[] = [];
let mockLive: unknown = null;
// The simulated lane's demo picture (Skia) is never drawn here: every case is a Core in real capture.
jest.mock('@/components/media', () => ({ CameraFeed: () => null }));
// The preview reads the Live source through the light Live API (`useLiveSelector`); the mode badge through `useMobileLive`.
jest.mock('@dems/shared/live', () => {
  const actual = jest.requireActual<typeof import('@dems/shared/live')>('@dems/shared/live');
  return { ...actual, useLiveSelector: (read: (live: unknown) => unknown) => read(mockLive) };
});
jest.mock('@/runtime', () => {
  const actual = jest.requireActual<typeof import('@/runtime')>('@/runtime');
  return { ...actual, useMobileLive: () => mockLive };
});

/** The fake `expo/fetch`: one controllable stream per request. */
type Stream = { signal: AbortSignal; push(chunk: Uint8Array): void };
const mockStreams: Stream[] = [];
let mockStreamStatus = 200;
const mockStreamFetch = jest.fn((_url: string, init: { signal: AbortSignal }) => {
  const { signal } = init;
  const queue: Uint8Array[] = [];
  let waiting: { resolve: (r: { value?: Uint8Array; done: boolean }) => void; reject: (e: Error) => void } | null = null;
  const abortError = () => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });
  signal.addEventListener('abort', () => waiting?.reject(abortError()));
  mockStreams.push({
    signal,
    push(chunk) {
      const w = waiting;
      waiting = null;
      if (w !== null) w.resolve({ value: chunk, done: false });
      else queue.push(chunk);
    },
  });
  const reader = {
    read: () => {
      if (signal.aborted) return Promise.reject(abortError());
      const next = queue.shift();
      if (next !== undefined) return Promise.resolve({ value: next, done: false });
      return new Promise<{ value?: Uint8Array; done: boolean }>((resolve, reject) => {
        waiting = { resolve, reject };
      });
    },
    cancel: async () => undefined,
  };
  const status = mockStreamStatus;
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'multipart/x-mixed-replace; boundary=demsframe' : null) },
    body: { getReader: () => reader, cancel: async () => undefined },
  });
});
jest.mock('expo/fetch', () => ({ fetch: (url: string, init: { signal: AbortSignal }) => mockStreamFetch(url, init) }));

const TRACK = 'VIDEO-01' as const;
type Device = SimState['captureDevices']['devices'][number];
let test: TestSim;
let cameraId: string;
let written: unknown[];
let abortSpy: jest.SpiedFunction<AbortController['abort']>;
const consoleSpies: jest.SpiedFunction<(...args: unknown[]) => void>[] = [];

function signedInLive() {
  const transport = { origin: ORIGIN } as { origin: string; headers: Record<string, string> };
  Object.defineProperty(transport, 'headers', { value: Object.freeze({ Authorization: `Bearer ${SESSION}` }), enumerable: false });
  return {
    client: { call: op112 },
    mediaTransport: () => transport,
    onSessionEnd: (listener: (end: unknown) => void) => {
      endListeners.push(listener);
      return () => {
        endListeners = endListeners.filter((entry) => entry !== listener);
      };
    },
  };
}

beforeEach(() => {
  mockLive = signedInLive();
  endListeners = [];
  mockStreams.length = 0;
  mockStreamStatus = 200;
  mockStreamFetch.mockClear();
  op112.mockReset();
  op112.mockResolvedValue({ ok: true, status: 201, data: { url: URL_TEXT, expiresAt: 1_790_825_000_000 } });
  resetCameraPreviewRetries();
  resetCameraStreamClaims();
  resetMissingKeys();
  written = [];
  jest.spyOn(runtimeLog, 'write').mockImplementation(((...args: unknown[]) => {
    written.push(args);
  }) as never);
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    consoleSpies.push(
      jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        written.push(args.map((arg) => (arg instanceof Error ? `${arg.message}\n${arg.stack ?? ''}` : arg)));
      }) as never,
    );
  }
  abortSpy = jest.spyOn(AbortController.prototype, 'abort');
  test = createTestSim();
  const line = test.sim.store.getState().captureConfig.cameras.find((entry) => entry.trackId === TRACK);
  if (line === undefined) throw new Error('the test simulator has no VIDEO-01 line');
  cameraId = line.deviceId;
});

afterEach(() => {
  cleanup();
  // M3-09 R5: no captured log call, of any level, holds the URL, its token or the session token.
  const all = JSON.stringify(written, (_key, value: unknown) => (value instanceof Error ? `${value.message} ${value.stack ?? ''}` : value));
  for (const secret of SECRETS) expect([secret, all.includes(secret)]).toEqual([secret, false]);
  jest.restoreAllMocks();
  consoleSpies.length = 0;
  resetCameraPreviewRetries();
  resetCameraStreamClaims();
  expect(getMissingKeys()).toEqual([]);
});

function setCamera(patch: Partial<Pick<Device, 'sourceClass' | 'reach' | 'checkedAt' | 'adapter'>>, online = true): void {
  act(() =>
    test.sim.store.setState((s) => ({
      captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => (device.id === cameraId ? { ...device, ...patch } : device)) },
      captureConfig: { ...s.captureConfig, cameras: s.captureConfig.cameras.map((entry) => (entry.trackId === TRACK ? { ...entry, online } : entry)) },
    })),
  );
}
const production = (reach: CaptureDeviceReach | null = null, checkedAt: number | null = null) => setCamera({ sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP', reach, checkedAt });

const enc = (text: string): Uint8Array => Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff);
function frame(n: number): Uint8Array {
  const body = Uint8Array.from([0xff, 0xd8, n, 0xff, 0xd9]);
  const head = enc(`--demsframe\r\nContent-Type: image/jpeg\r\nContent-Length: ${body.length}\r\n\r\n`);
  const all = new Uint8Array(head.length + body.length + 2);
  all.set(head);
  all.set(body, head.length);
  all.set(enc('\r\n'), head.length + body.length);
  return all;
}

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
};

function renderTile(count = 1) {
  return render(
    <HeroUINativeProvider>
      <SimProvider sim={test.sim} autoStart={false}>
        {Array.from({ length: count }, (_, i) => (
          <CameraPreview key={i} cameraId="CAM-1" trackId={TRACK} motion="reduced" livePreview testID={i === 0 ? 'tile' : `tile-${String(i)}`} />
        ))}
      </SimProvider>
    </HeroUINativeProvider>,
  );
}
const op112Calls = () => op112.mock.calls.filter(([operationId]) => operationId === 'createCameraPreviewSession').length;
const warnRecords = () => (written as unknown[][]).filter((args) => (args[0] as { source?: string } | undefined)?.source?.startsWith('devices.preview.') === true);

describe('the gate decides every op 112 (D185)', () => {
  it('a camera stated NOT_REACHABLE: 0 op 112, 0 streams, the neutral tile and "Try again"', async () => {
    production(CaptureDeviceReach.NOT_REACHABLE, 1_000);
    renderTile();
    await flush();
    expect(op112Calls()).toBe(0);
    expect(mockStreamFetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('tile')).toBeTruthy();
    expect(screen.getByTestId('device-preview-try-again-CAM-1')).toBeTruthy();
  });

  it('CONTROL: without livePreview the tile asks for nothing, even when the gate is open', async () => {
    production();
    render(
      <HeroUINativeProvider>
        <SimProvider sim={test.sim} autoStart={false}>
          <CameraPreview cameraId="CAM-1" trackId={TRACK} motion="reduced" testID="tile" />
        </SimProvider>
      </HeroUINativeProvider>,
    );
    await flush();
    expect(op112Calls()).toBe(0);
  });

  it('while a session is being started the Core has the camera (M3-09 R6): the rule of the ask', () => {
    // The store bed holds no open session to put in PRECHECK; the rule the component reads is pinned here.
    expect(['CREATE', 'PRECHECK', 'ARMED'].map(isSessionStarting)).toEqual([true, true, true]);
    expect(['RECORDING', 'STOPPING', 'IDLE', null, undefined].map(isSessionStarting)).toEqual([false, false, false, false, false]);
  });
});

describe('an open preview (M3-09 R1, R4)', () => {
  it('op 112 once, then the stream with the bearer and no cookie; frames show; unmount calls abort() exactly once', async () => {
    production(CaptureDeviceReach.REACHABLE, 1_000);
    const view = renderTile();
    await flush();
    expect(op112Calls()).toBe(1);
    expect(op112).toHaveBeenCalledWith('createCameraPreviewSession', { params: { id: cameraId } });
    expect(mockStreamFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockStreamFetch.mock.calls[0] as unknown as [string, { headers: Record<string, string>; credentials: string }];
    expect(url).toBe(URL_TEXT);
    expect(init.headers).toEqual({ Authorization: `Bearer ${SESSION}` });
    expect(init.credentials).toBe('omit');
    // Until the first frame the neutral tile stands.
    expect(screen.queryByTestId('tile-live-picture')).toBeNull();
    await act(async () => {
      mockStreams[0]?.push(frame(1));
      await Promise.resolve();
    });
    await flush();
    const picture = screen.getByTestId('tile-live-picture');
    expect(String((picture.props.source as { uri?: string } | undefined)?.uri ?? picture.props.source?.[0]?.uri)).toMatch(/^data:image\/jpeg;base64,/);
    expect(abortSpy).toHaveBeenCalledTimes(0);
    view.unmount();
    await flush();
    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(mockStreams[0]?.signal.aborted).toBe(true);
    // Nothing is said of a close the app made itself.
    expect(warnRecords()).toHaveLength(0);
    expect(op112Calls()).toBe(1);
  });

  it('a newer NOT_REACHABLE closes the open stream (the gate unmounts it): abort() once, no new op 112', async () => {
    production(CaptureDeviceReach.REACHABLE, 1_000);
    renderTile();
    await flush();
    expect(mockStreamFetch).toHaveBeenCalledTimes(1);
    production(CaptureDeviceReach.NOT_REACHABLE, 2_000);
    await flush();
    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(op112Calls()).toBe(1);
    expect(screen.getByTestId('device-preview-try-again-CAM-1')).toBeTruthy();
  });

  it('the operator\'s session ends: abort() once, the neutral tile, nothing asked again', async () => {
    production();
    renderTile();
    await flush();
    expect(mockStreamFetch).toHaveBeenCalledTimes(1);
    act(() => endListeners.forEach((listener) => listener({ kind: 'SESSION_ENDED', reason: null })));
    await flush();
    expect(abortSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('tile')).toBeTruthy();
    expect(op112Calls()).toBe(1);
  });

  it('P5: two tiles of one camera open ONE stream', async () => {
    production();
    renderTile(2);
    await flush();
    expect(op112Calls()).toBe(1);
    expect(mockStreamFetch).toHaveBeenCalledTimes(1);
  });
});

describe('refusals: the neutral tile, 0 retries (M3-09 R3)', () => {
  it.each([
    [409, 'INVALID_STATE', false],
    [429, 'RATE_LIMITED', false],
    [401, 'NOT_SIGNED_IN', true],
    [403, 'FORBIDDEN', true],
  ])('op 112 answers %i: the neutral tile, no stream, no retry (runtime report: %s -> %s)', async (status, code, reported) => {
    jest.useFakeTimers();
    try {
      production();
      op112.mockResolvedValue({ ok: false, status, error: { code } });
      renderTile();
      await flush();
      expect(op112Calls()).toBe(1);
      expect(mockStreamFetch).not.toHaveBeenCalled();
      expect(screen.getByTestId('tile')).toBeTruthy();
      expect(screen.queryByTestId('tile-live-picture')).toBeNull();
      // Two minutes and a store change later: still ONE ask.
      await act(async () => {
        jest.advanceTimersByTime(120_000);
      });
      setCamera({ adapter: 'ONVIF_RTSP' });
      await flush();
      expect(op112Calls()).toBe(1);
      expect(warnRecords().length).toBe(reported ? 1 : 0);
      if (reported) expect(JSON.stringify(warnRecords())).toContain(`"status":${String(status)}`);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([401, 403, 409, 429])('the stream answers %i: the neutral tile, no retry', async (status) => {
    production();
    mockStreamStatus = status;
    renderTile();
    await flush();
    expect(op112Calls()).toBe(1);
    expect(mockStreamFetch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('tile')).toBeTruthy();
    setCamera({ adapter: 'ONVIF_RTSP' });
    await flush();
    expect(op112Calls()).toBe(1);
    expect(mockStreamFetch).toHaveBeenCalledTimes(1);
    expect(warnRecords().length).toBe(status === 401 || status === 403 ? 1 : 0);
  });

  it('no operator session in memory: no op 112, no stream, the neutral tile and one report', async () => {
    production();
    mockLive = { ...signedInLive(), mediaTransport: () => null };
    renderTile();
    await flush();
    expect(op112Calls()).toBe(0);
    expect(mockStreamFetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('tile')).toBeTruthy();
    expect(warnRecords()).toHaveLength(1);
  });
});

// Row 231 (M3 cycle 2, F3; test/12_m3_ui_tablet.md §7): the Home tile stays MOUNTED while another screen is on top
// (`paused={!focused}`, device-tiles.tsx / device-detail.tsx). Its hold of the camera's one stream (P5) must go
// with its focus, or the detail of the same camera waits for ever ("No preview", no op 112).
describe('one stream per camera across screens (row 231, F3)', () => {
  /** Home's tile and the Devices detail of the SAME camera, as the stack mounts them. */
  function Screens({ homePaused, detail }: { readonly homePaused: boolean; readonly detail: boolean }) {
    return (
      <HeroUINativeProvider>
        <SimProvider sim={test.sim} autoStart={false}>
          <CameraPreview cameraId="CAM-1" trackId={TRACK} motion="reduced" livePreview paused={homePaused} compact testID="home" />
          {detail ? <CameraPreview cameraId="CAM-1" trackId={TRACK} motion="reduced" livePreview paused={false} testID="detail" /> : null}
        </SimProvider>
      </HeroUINativeProvider>
    );
  }
  /** Open streams (not aborted) at the moment of each op 112: must be 0 every time (one op 112 per camera at a time). */
  let openAtAsk: number[];
  beforeEach(() => {
    openAtAsk = [];
    op112.mockImplementation(() => {
      openAtAsk.push(mockStreams.filter((stream) => !stream.signal.aborted).length);
      return Promise.resolve({ ok: true, status: 201, data: { url: URL_TEXT, expiresAt: 1_790_825_000_000 } });
    });
  });
  const pushTo = async (index: number, n: number) => {
    await act(async () => {
      mockStreams[index]?.push(frame(n));
      await Promise.resolve();
    });
    await flush();
  };
  const openStreams = () => mockStreams.filter((stream) => !stream.signal.aborted).length;

  it('Home focused, then the detail focused: the detail renders frames; back to Home: Home renders again', async () => {
    production(CaptureDeviceReach.REACHABLE, 1_000);
    const view = render(<Screens homePaused={false} detail={false} />);
    await flush();
    expect(op112Calls()).toBe(1);
    await pushTo(0, 1);
    expect(screen.getByTestId('home-live-picture')).toBeTruthy();

    // The detail is pushed: it mounts focused, Home stays mounted and loses focus.
    view.rerender(<Screens homePaused detail />);
    await flush();
    expect(mockStreams[0]?.signal.aborted).toBe(true);
    expect(op112Calls()).toBe(2);
    expect(mockStreamFetch).toHaveBeenCalledTimes(2);
    await pushTo(1, 2);
    expect(screen.getByTestId('detail-live-picture')).toBeTruthy();
    // Home draws its neutral tile while unfocused, not a stale frame.
    expect(screen.queryByTestId('home-live-picture')).toBeNull();

    // Back: the detail is popped (unmounted), Home is focused again.
    view.rerender(<Screens homePaused={false} detail={false} />);
    await flush();
    expect(mockStreams[1]?.signal.aborted).toBe(true);
    expect(op112Calls()).toBe(3);
    await pushTo(2, 3);
    expect(screen.getByTestId('home-live-picture')).toBeTruthy();
    expect(openStreams()).toBe(1);
  });

  it('one op 112 per camera at a time: no ask while a stream of that camera is open, and at most one stream open', async () => {
    production(CaptureDeviceReach.REACHABLE, 1_000);
    const view = render(<Screens homePaused={false} detail={false} />);
    await flush();
    // The detail mounts BEFORE Home's blur lands (the stack's order): it waits, it does not ask.
    view.rerender(<Screens homePaused={false} detail />);
    await flush();
    expect(op112Calls()).toBe(1);
    expect(openStreams()).toBe(1);
    view.rerender(<Screens homePaused detail />);
    await flush();
    view.rerender(<Screens homePaused={false} detail={false} />);
    await flush();
    expect(op112Calls()).toBe(3);
    expect(openAtAsk).toEqual([0, 0, 0]);
    expect(openStreams()).toBe(1);
    view.unmount();
    await flush();
    // Every stream closes when its last viewer goes.
    expect(openStreams()).toBe(0);
  });

  it('a refused tile is not asked again by a blur and a refocus (D218 §5: no automatic retry)', async () => {
    production(CaptureDeviceReach.REACHABLE, 1_000);
    op112.mockResolvedValue({ ok: false, status: 409, error: { code: 'PREVIEW_NOT_AVAILABLE' } });
    const view = render(<Screens homePaused={false} detail={false} />);
    await flush();
    expect(op112Calls()).toBe(1);
    view.rerender(<Screens homePaused detail={false} />);
    await flush();
    view.rerender(<Screens homePaused={false} detail={false} />);
    await flush();
    expect(op112Calls()).toBe(1);
    expect(mockStreamFetch).not.toHaveBeenCalled();
    expect(screen.getByTestId('home')).toBeTruthy();
  });
});
