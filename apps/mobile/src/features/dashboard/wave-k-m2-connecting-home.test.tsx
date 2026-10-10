// Fix wave K, driver M2 - item 3 (G75c-07; ux 8e.2: no recording indicator and no meters before the
// first durable fragment) and item 5 (the real-capture facts of Home and Storage; the mirror of the
// web's C-2).
//
// | Finding | Rule | Where |
// |---------|------|-------|
// | G75c-07 | The tablet Home header chip reads CONNECTING (neutral), never RECORDING, while `captureDurable` is false | "the header chip" |
// | G75c-07 | A Home microphone tile draws no meter, no level and no Active / Standby then | "the microphone tiles" |
// | G75c-07 | The "No preview" tile of a camera with no named cause reads "Connecting cameras…", not "Not reachable" | "the no-preview tile" |
// | C-2 mirror | On a Core that states `security.platformNotReported` the Storage write speed and time left read "Not reported" (no 8.2 GB/h) | "storage" |
// Each case holds its CONTROL: a durable session / the simulated device keeps its words.
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { DEMO_OPERATOR_PASSWORD, PLATFORM_NOT_REPORTED } from '@dems/shared/sim';
import { NoPreviewTile } from '@/features/devices/camera-preview';
import { StorageKpis } from '@/features/storage/storage-kpis';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreLinkPrefsForTests } from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';
import { DashboardScreen } from './dashboard-screen';
import { chipRowFor } from './home-model';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
  useIsFocused: () => true,
}));

const TABLET = { width: 1280, height: 800 };
const PHONE = { width: 411, height: 923 };
const setWindow = ({ width, height }: { width: number; height: number }) =>
  act(() => {
    Dimensions.set({ window: { width, height, scale: 2, fontScale: 1 }, screen: { width, height, scale: 2, fontScale: 1 } });
  });

const textOf = (testID: string): string => {
  const parts: string[] = [];
  const walk = (n: ReactTestInstance | string) => {
    if (typeof n === 'string') parts.push(n);
    else n.children.forEach(walk);
  };
  walk(screen.getAllByTestId(testID)[0]!);
  return parts.join('');
};
const count = (testID: string | RegExp): number => screen.queryAllByTestId(testID).length;
const setDurable = (test: TestSim, captureDurable: boolean) => act(() => test.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable } })));

function recording(): TestSim {
  const test = createTestSim({ scenario: 'recording' });
  expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  expect(test.sim.store.getState().session?.state).toBe('RECORDING');
  return test;
}

beforeAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, 50));
});
beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetMotionStateForTests();
  resetLoopRegistryForTests();
  resetMissingKeys();
});
afterEach(() => {
  cleanup();
  setWindow(PHONE);
  expect(getMissingKeys()).toEqual([]);
});

describe('G75c-07 - Home while the cameras connect', () => {
  it('the header chip (tablet): RECORDING for a durable session; CONNECTING, never RECORDING, before the first durable fragment', async () => {
    setWindow(TABLET);
    const test = recording();
    renderWithRuntime(<DashboardScreen />, { sim: test.sim });
    await flushAsync();
    // CONTROL: a session without the member (and a durable one) is a recording.
    expect(textOf('home-header-state')).toBe('RECORDING');
    setDurable(test, false);
    expect(textOf('home-header-state')).toBe('CONNECTING');
    expect(screen.queryByText('RECORDING')).toBeNull();
    setDurable(test, true);
    expect(textOf('home-header-state')).toBe('RECORDING');
  });

  it('the microphone tiles (tablet): no meter, no dBFS and no Active / Standby before the first durable fragment; the word CONNECTING in their place', async () => {
    setWindow(TABLET);
    const test = recording();
    renderWithRuntime(<DashboardScreen />, { sim: test.sim });
    await flushAsync();
    // CONTROL: the durable recording draws both meters.
    for (const track of ['AUDIO-01', 'AUDIO-02']) {
      expect(count(`home-device-${track}-meter`)).toBeGreaterThan(0);
      expect(count(`home-device-${track}-connecting`)).toBe(0);
    }
    setDurable(test, false);
    for (const track of ['AUDIO-01', 'AUDIO-02']) {
      expect(count(`home-device-${track}-meter`)).toBe(0);
      expect(count(`home-device-${track}-dbfs`)).toBe(0);
      expect(count(`home-device-${track}-role`)).toBe(0);
      expect(textOf(`home-device-${track}-connecting`)).toBe('CONNECTING');
      expect(String(screen.getAllByTestId(`home-device-${track}-connecting`)[0]!.props.accessibilityLabel)).toMatch(/: Connecting cameras…$/);
    }
    setDurable(test, true);
    for (const track of ['AUDIO-01', 'AUDIO-02']) expect(count(`home-device-${track}-meter`)).toBeGreaterThan(0);
  });

  it('the no-preview tile: "Connecting cameras…" while the session connects; the roster\'s word otherwise', async () => {
    const test = recording();
    const cameraId = test.sim.store.getState().captureConfig.cameras.find((line) => line.trackId === 'VIDEO-01')!.deviceId;
    // The Core has not reached the camera yet (its roster entry is offline) and names no cause.
    act(() => test.sim.store.setState((s) => ({ captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => (device.id === cameraId ? { ...device, online: false } : device)) } })));
    renderWithRuntime(<NoPreviewTile trackId="VIDEO-01" name="CAM 1" />, { sim: test.sim });
    await flushAsync();
    // CONTROL: outside the connecting phase the roster's own word stands.
    expect(textOf('no-preview-VIDEO-01-state')).toBe('Not reachable');
    setDurable(test, false);
    expect(textOf('no-preview-VIDEO-01-state')).toBe('Connecting cameras…');
    expect(screen.queryByText('Not reachable')).toBeNull();
    setDurable(test, true);
    expect(textOf('no-preview-VIDEO-01-state')).toBe('Not reachable');
  });
});

describe('the real-capture facts of Home and Storage (mirror of the web\'s C-2)', () => {
  const ownCapture = (test: TestSim) => act(() => test.sim.store.setState((s) => ({ security: { ...s.security, ...PLATFORM_NOT_REPORTED } })));

  it('storage: on a Core that states `security.platformNotReported` the write speed and the time left read "Not reported" - no MB/s, no 8.2 GB/h', async () => {
    const test = recording();
    renderWithRuntime(<StorageKpis variant="tiles" />, { sim: test.sim });
    await flushAsync();
    const all = () => {
      const parts: string[] = [];
      const walk = (n: ReactTestInstance | string) => {
        if (typeof n === 'string') parts.push(n);
        else n.children.forEach(walk);
      };
      walk(screen.UNSAFE_root);
      return parts.join(' | ');
    };
    // SIMULATED, pinned: the simulated device keeps its figures.
    expect(all()).toMatch(/8\.2 GB\/h/);
    expect(all()).toMatch(/MB\/s/);
    expect(all()).not.toMatch(/Not reported/);
    ownCapture(test);
    expect(all()).not.toMatch(/GB\/h/);
    expect(all()).not.toMatch(/MB\/s/);
    expect(all().match(/Not reported/g)?.length).toBe(2);
  });

  it('home chips: posture "Not reported" and "Host system clock" on such a Core; the simulated device keeps "Secure" and its time source', () => {
    const real = chipRowFor({ posture: 'SECURE', platformNotReported: true, timeSource: 'RTC', timeLocked: false, hostClock: true, linkUp: true });
    expect(real.find((chip) => chip.id === 'security')).toMatchObject({ valueKey: 'common.platformNotReported.value', tone: 'default' });
    expect(real.find((chip) => chip.id === 'time')).toMatchObject({ valueKey: 'session.captureFacts.timeSource.hostClock' });
    // SIMULATED, pinned.
    const simulated = chipRowFor({ posture: 'SECURE', timeSource: 'GNSS', timeLocked: true, linkUp: true });
    expect(simulated.find((chip) => chip.id === 'security')).toMatchObject({ valueKey: 'common.posture.SECURE', tone: 'success' });
    expect(simulated.find((chip) => chip.id === 'time')).toMatchObject({ valueKey: 'common.status.synchronized', tone: 'success' });
  });
});
