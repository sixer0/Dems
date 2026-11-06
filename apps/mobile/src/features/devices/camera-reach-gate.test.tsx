// Row 194 (M3-09 R2, register P17; D97, D98): the tablet's reach gate of the live camera preview, the twin of the
// web's row 130 / 130b gate (`apps/core-web/src/features/devices/camera-live-preview.ts:211-285`).
//
// The live child stands in for row 195's preview: it sends "operation 112" once when it mounts and closes when it
// unmounts, as a preview does. So the op-112 count below is the number of times the gate let a preview open.
// The store is a real test simulator; Live client mode is stood in for by `useMobileLive` (as camera-no-preview.test.tsx).
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import { type ReactNode, useEffect } from 'react';
import { Text } from 'react-native';
import { CaptureDeviceReach } from '@dems/shared/api';
import { SimProvider, type SimState } from '@dems/shared/sim';
import { getMissingKeys, i18n, resetMissingKeys } from '@/i18n';
import { createTestSim, type TestSim } from '@/runtime/testing/test-sim';
import {
  CameraReachPhase,
  DevicePreviewTryAgain,
  ReachGatedCameraPreview,
  cameraHeldByReach,
  cameraReachPhaseOf,
  isReachGatedCamera,
  mayRequestCameraPreview,
  requestCameraPreviewRetry,
  resetCameraPreviewRetries,
  useCameraReachGate,
} from './camera-reach-gate';

/** What `useMobileLive()` answers: null = Simulated client mode; an object = Live. */
let mockLive: { client: { call: () => Promise<unknown> } } | null = null;
jest.mock('@/runtime', () => {
  const actual = jest.requireActual<typeof import('@/runtime')>('@/runtime');
  return { ...actual, useMobileLive: () => mockLive };
});

const TRACK = 'VIDEO-01' as const;
const TRY_AGAIN = `device-preview-try-again-${TRACK}`;
type Device = SimState['captureDevices']['devices'][number];

/** The stand-in for operation 112 (row 195 sends the real one from inside `renderLive`). */
const op112 = jest.fn<(deviceId: string) => void>();
const closed = jest.fn<() => void>();

function LiveProbe({ deviceId }: { readonly deviceId: string }) {
  useEffect(() => {
    op112(deviceId);
    return () => closed();
  }, [deviceId]);
  return <Text testID="live-preview">live</Text>;
}

let test: TestSim;
let cameraId: string;

beforeEach(() => {
  mockLive = { client: { call: async () => ({ ok: false, status: 503, error: { code: 'NOT_READY' } }) } };
  op112.mockClear();
  closed.mockClear();
  resetCameraPreviewRetries();
  resetMissingKeys();
  test = createTestSim();
  const line = test.sim.store.getState().captureConfig.cameras.find((entry) => entry.trackId === TRACK);
  if (line === undefined) throw new Error('the test simulator has no VIDEO-01 line');
  cameraId = line.deviceId;
});
afterEach(() => {
  cleanup();
  resetCameraPreviewRetries();
  expect(getMissingKeys()).toEqual([]);
});

/** Marks the track's camera (and its selector line's `online`), inside `act`. */
function setCamera(patch: Partial<Pick<Device, 'sourceClass' | 'reach' | 'checkedAt' | 'adapter'>>, online = true): void {
  act(() =>
    test.sim.store.setState((s) => ({
      captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => (device.id === cameraId ? { ...device, ...patch } : device)) },
      captureConfig: { ...s.captureConfig, cameras: s.captureConfig.cameras.map((line) => (line.trackId === TRACK ? { ...line, online } : line)) },
    })),
  );
}
const production = (reach: CaptureDeviceReach | null, checkedAt: number | null, online = true) => setCamera({ sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP', reach, checkedAt }, online);

function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <HeroUINativeProvider>
      <SimProvider sim={test.sim} autoStart={false}>
        {children}
      </SimProvider>
    </HeroUINativeProvider>
  );
}

function renderGate() {
  return render(
    <Providers>
      <ReachGatedCameraPreview trackId={TRACK} renderLive={() => <LiveProbe deviceId={cameraId} />} fallback={<Text testID="fallback-tile">No preview</Text>} />
    </Providers>,
  );
}

describe('the pure rule (P17)', () => {
  const prod = { id: 'CAM-03', kind: 'CAMERA', sourceClass: 'PRODUCTION' } as const;
  it('a production camera is gated; a development source, a mic or no device is not', () => {
    expect(isReachGatedCamera(prod)).toBe(true);
    expect(isReachGatedCamera({ ...prod, sourceClass: 'DEVELOPMENT' })).toBe(false);
    expect(isReachGatedCamera({ ...prod, kind: 'MIC' })).toBe(false);
    expect(isReachGatedCamera(undefined)).toBe(false);
  });
  it('only a stated NOT_REACHABLE holds', () => {
    expect(cameraHeldByReach({ reach: CaptureDeviceReach.NOT_REACHABLE })).toBe(true);
    expect([CaptureDeviceReach.REACHABLE, null, undefined].map((reach) => cameraHeldByReach({ reach }))).toEqual([false, false, false]);
  });
  it('the phases, and op 112 only in OPEN', () => {
    const phase = (over: Partial<Parameters<typeof cameraReachPhaseOf>[0]>) => cameraReachPhaseOf({ live: true, device: prod, online: true, retryStanding: false, ...over });
    expect(phase({ live: false })).toBe(CameraReachPhase.NOT_APPLICABLE);
    expect(phase({ device: undefined })).toBe(CameraReachPhase.NOT_APPLICABLE);
    expect(phase({ device: { ...prod, sourceClass: 'DEVELOPMENT' } })).toBe(CameraReachPhase.NOT_APPLICABLE);
    expect(phase({ online: false, device: { ...prod, reach: 'NOT_REACHABLE' } })).toBe(CameraReachPhase.OFFLINE);
    expect(phase({ device: { ...prod, reach: 'NOT_REACHABLE' } })).toBe(CameraReachPhase.HELD);
    expect(phase({ device: { ...prod, reach: 'NOT_REACHABLE' }, retryStanding: true })).toBe(CameraReachPhase.OPEN);
    expect(phase({ device: { ...prod, reach: 'REACHABLE' } })).toBe(CameraReachPhase.OPEN);
    expect(phase({ device: { ...prod, reach: null } })).toBe(CameraReachPhase.OPEN);
    expect(Object.values(CameraReachPhase).filter(mayRequestCameraPreview)).toEqual([CameraReachPhase.OPEN]);
  });
});

describe('ReachGatedCameraPreview: the acceptance of M3-09 R2', () => {
  it('a camera stated NOT_REACHABLE: 0 calls of op 112, the fallback tile and "Try again" (P14, P16, P15)', () => {
    production(CaptureDeviceReach.NOT_REACHABLE, 1_000);
    renderGate();
    expect(op112).toHaveBeenCalledTimes(0);
    expect(screen.queryByTestId('live-preview')).toBeNull();
    expect(screen.getByTestId('fallback-tile')).toBeTruthy();
    expect(screen.getByTestId(TRY_AGAIN)).toBeTruthy();
    expect(screen.getByText(i18n.t('devices.preview.tryAgain'))).toBeTruthy();
    expect(screen.getByTestId(`${TRY_AGAIN}-text`)).toHaveTextContent(i18n.t('devices.preview.notReachable'), { exact: false });
    expect(screen.getByTestId(`${TRY_AGAIN}-text`)).toHaveTextContent(/Checked at \d\d:\d\d:\d\d/);
    // A store change that states no newer reading asks for nothing either.
    setCamera({ adapter: 'ONVIF_RTSP' });
    expect(op112).toHaveBeenCalledTimes(0);
  });

  it('one press of "Try again" gives exactly 1 call, and the button is gone while the press stands', () => {
    production(CaptureDeviceReach.NOT_REACHABLE, 1_000);
    renderGate();
    fireEvent.press(screen.getByTestId(`${TRY_AGAIN}-press`));
    expect(op112).toHaveBeenCalledTimes(1);
    expect(op112).toHaveBeenCalledWith(cameraId);
    expect(screen.getByTestId('live-preview')).toBeTruthy();
    expect(screen.queryByTestId(TRY_AGAIN)).toBeNull();
    // Re-renders with the same reading keep the one preview: no second call.
    setCamera({ adapter: 'ONVIF_RTSP' });
    expect(op112).toHaveBeenCalledTimes(1);
  });

  it('a newer NOT_REACHABLE closes the open preview; a newer REACHABLE opens it', () => {
    production(CaptureDeviceReach.NOT_REACHABLE, 1_000);
    renderGate();
    fireEvent.press(screen.getByTestId(`${TRY_AGAIN}-press`));
    expect(op112).toHaveBeenCalledTimes(1);

    production(CaptureDeviceReach.NOT_REACHABLE, 2_000);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('live-preview')).toBeNull();
    expect(screen.getByTestId(TRY_AGAIN)).toBeTruthy();
    expect(op112).toHaveBeenCalledTimes(1);

    production(CaptureDeviceReach.REACHABLE, 3_000);
    expect(screen.getByTestId('live-preview')).toBeTruthy();
    expect(screen.queryByTestId(TRY_AGAIN)).toBeNull();
    expect(op112).toHaveBeenCalledTimes(2);

    // And a REACHABLE preview that the Core then finds NOT_REACHABLE closes as well.
    production(CaptureDeviceReach.NOT_REACHABLE, 4_000);
    expect(closed).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('live-preview')).toBeNull();
    expect(op112).toHaveBeenCalledTimes(2);
  });

  it('REACHABLE, or never stated, on an online production camera opens at once (1 call)', () => {
    production(null, null);
    renderGate();
    expect(op112).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(TRY_AGAIN)).toBeNull();
  });

  it('CONTROL: an offline line, a development source and Simulated mode never ask and draw no "Try again"', () => {
    production(CaptureDeviceReach.NOT_REACHABLE, 1_000, false);
    const view = renderGate();
    expect(screen.getByTestId('fallback-tile')).toBeTruthy();
    expect(screen.queryByTestId(TRY_AGAIN)).toBeNull();
    view.unmount();

    setCamera({ sourceClass: 'DEVELOPMENT', adapter: 'FAKE', reach: null, checkedAt: null });
    renderGate().unmount();

    mockLive = null;
    production(null, null);
    renderGate();
    expect(screen.getByTestId('fallback-tile')).toBeTruthy();
    expect(op112).toHaveBeenCalledTimes(0);
  });
});

describe('the hook and the standalone "Try again" (the API rows 195 and 196 mount)', () => {
  it('useCameraReachGate: mayRequest only when OPEN; tryAgain is a no-op outside HELD', () => {
    production(CaptureDeviceReach.REACHABLE, 1_000);
    const hook = renderHook(() => useCameraReachGate(TRACK), { wrapper: Providers });
    expect(hook.result.current).toMatchObject({ phase: CameraReachPhase.OPEN, mayRequest: true, deviceId: cameraId, checkedAt: 1_000 });
    act(() => hook.result.current.tryAgain());
    production(CaptureDeviceReach.NOT_REACHABLE, 2_000);
    expect(hook.result.current).toMatchObject({ phase: CameraReachPhase.HELD, mayRequest: false });
    act(() => hook.result.current.tryAgain());
    expect(hook.result.current).toMatchObject({ phase: CameraReachPhase.OPEN, mayRequest: true });
  });

  it('a retry requested for one device does not open another', () => {
    production(CaptureDeviceReach.NOT_REACHABLE, 1_000);
    act(() => requestCameraPreviewRetry('CAM-99', 1_000));
    renderGate();
    expect(op112).toHaveBeenCalledTimes(0);
  });

  it('DevicePreviewTryAgain is drawn only in HELD, under the caller\'s camera id', () => {
    production(CaptureDeviceReach.NOT_REACHABLE, null);
    render(
      <Providers>
        <DevicePreviewTryAgain trackId={TRACK} cameraId="CAM-1" />
      </Providers>,
    );
    expect(screen.getByTestId('device-preview-try-again-CAM-1')).toBeTruthy();
    expect(screen.getByTestId('device-preview-try-again-CAM-1-text')).not.toHaveTextContent(/Checked at/);
    fireEvent.press(screen.getByTestId('device-preview-try-again-CAM-1-press'));
    expect(screen.queryByTestId('device-preview-try-again-CAM-1')).toBeNull();
  });
});
