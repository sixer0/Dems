// Fix wave H — G70-03 / G75-13 (ruling D196) on the Home device tiles (tablet and phone), LIVE mode on
// the app's own Live source over the contract-checked fake transport (`dashboard/testing/live-home-bed`).
// The fixture SAYS what a Core in real capture sends and opens nothing (decision D163).
// NOT proven here: a device and a real Core (re-gate).
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, screen, within } from '@testing-library/react-native';
import type { SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests } from '@/runtime';
import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import { createHomeBed, type HomeBed } from '@/features/dashboard/testing/live-home-bed';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
}));

let bed: HomeBed | null = null;
type Mark = { sourceClass: 'DEVELOPMENT' | 'PRODUCTION'; adapter: string; sourceOpen?: boolean };
const LOCAL: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' };
const FAKE: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' };
const NO_PREVIEW_LABEL = /No preview: this build shows no live picture of the cameras\./;

function marked(state: SimState, marks: Readonly<Record<string, Mark>>): SimState {
  return { ...state, captureDevices: { ...state.captureDevices, devices: state.captureDevices.devices.map((device) => ({ ...device, ...(marks[device.id] ?? {}) }) as typeof device) } };
}

beforeAll(async () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  await new Promise((resolve) => setTimeout(resolve, 50));
});

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetDebugLaunchForTests();
  resetCoreErrorPresenterForTests();
  resetMotionStateForTests({ linkMotion: 'off' });
  resetLoopRegistryForTests();
  resetMissingKeys();
});

afterEach(() => {
  if (bed !== null) {
    bed.stop();
    bed.fake.assertNoViolations();
    bed = null;
  }
  cleanup();
});

// Only the tablet in landscape draws the Home camera tiles (zone 2): the phone and the tablet in portrait draw none,
// so there is no picture there to replace (checked: `home-device-VIDEO-01-feed` does not exist in those windows).
describe.each(['tabletLandscape'] as const)('Home tiles on %s', (window) => {
  it('REAL capture: each camera tile is the "No preview" tile with the device name and its true state; no picture, no LIVE / DEMO text', async () => {
    bed = createHomeBed();
    bed.state = marked(bed.state, { 'CAM-01': LOCAL, 'CAM-02': FAKE, 'MIC-01': FAKE, 'MIC-02': FAKE });
    bed.mount(<DashboardScreen />, window);
    await bed.signIn();
    for (const [track, device, state] of [['VIDEO-01', "Core Mac's camera", 'Ready'], ['VIDEO-02', 'Camera CAM-02', 'Reachable']] as const) {
      const tile = screen.getByTestId(`home-device-${track}-feed`);
      expect(screen.getByTestId(`home-device-${track}-feed-none`)).toHaveTextContent('No preview');
      expect(screen.getByTestId(`home-device-${track}-feed-name`)).toHaveTextContent(new RegExp(device));
      expect(screen.getByTestId(`home-device-${track}-feed-state`)).toHaveTextContent(state);
      expect(tile.props.accessibilityRole).toBe('text');
      expect(tile.props.accessibilityLabel).toMatch(NO_PREVIEW_LABEL);
      expect(screen.queryByTestId(`home-device-${track}-feed-video`)).toBeNull();
      // On the whole tile (name, chip, badge, picture area): no LIVE / DEMO caption.
      expect(within(screen.getByTestId(`home-device-${track}`)).queryAllByText(/\b(LIVE|DEMO)\b/)).toHaveLength(0);
    }

    // The Core says the camera is open: the tile says so, and still shows no picture.
    await bed.pushState(marked(bed.state, { 'CAM-01': { ...LOCAL, sourceOpen: true }, 'CAM-02': FAKE }));
    expect(screen.getByTestId('home-device-VIDEO-01-feed-state')).toHaveTextContent('On');
    expect(getMissingKeys()).toEqual([]);
  });

  it('a Core in SIMULATED capture (no `sourceClass`): the demo feed as before, no "No preview" tile', async () => {
    bed = createHomeBed();
    bed.mount(<DashboardScreen />, window);
    await bed.signIn();
    for (const track of ['VIDEO-01', 'VIDEO-02']) {
      expect(screen.getByTestId(`home-device-${track}-feed`).props.accessibilityRole).toBe('image');
      expect(screen.queryByTestId(`home-device-${track}-feed-none`)).toBeNull();
    }
    expect(screen.queryByText('No preview')).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });
});
