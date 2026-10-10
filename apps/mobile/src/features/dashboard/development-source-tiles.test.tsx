// Integration pass D2, item 2 (row 138's request; ux spec §8f.2 "Session Monitor tiles", MB-01;
// decision D131) — the Home device tiles carry the one "Development source" badge, drawn from the
// Core's `sourceClass` only, in LIVE mode on the app's own Live source over the contract-checked
// fake transport (`testing/live-home-bed`). NOT proven here: a device, a real Core (gate flow F6).
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, screen } from '@testing-library/react-native';
import type { SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests } from '@/runtime';
import { DashboardScreen } from './dashboard-screen';
import { createHomeBed, shows, textOf, type HomeBed } from './testing/live-home-bed';

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

const TILES = ['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02'] as const;
const badged = () => TILES.filter((track) => shows(`home-device-${track}-source`));

/** The Core's devices with the given marks; every other device carries no `sourceClass` at all. */
function marked(state: SimState, marks: Readonly<Record<string, { sourceClass: 'DEVELOPMENT' | 'PRODUCTION'; adapter: string }>>): SimState {
  return {
    ...state,
    captureDevices: {
      ...state.captureDevices,
      devices: state.captureDevices.devices.map((device) => {
        const { sourceClass: _sourceClass, adapter: _adapter, ...bare } = device as typeof device & { sourceClass?: string; adapter?: string };
        const mark = marks[device.id];
        return (mark === undefined ? bare : { ...bare, ...mark }) as typeof device;
      }),
    },
  };
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

describe('Home tiles: the development-source badge (LIVE)', () => {
  it('no device carries `sourceClass`: no tile has a badge; the Core marks two devices: exactly their tiles do; the marks go: no badge again', async () => {
    bed = createHomeBed();
    bed.state = marked(bed.state, {});
    bed.mount(<DashboardScreen />, 'tabletLandscape');
    await bed.signIn();
    expect(screen.getByTestId('home-device-AUDIO-01')).toBeTruthy();
    expect(badged()).toEqual([]);
    expect(screen.queryByText('Development source')).toBeNull();

    // CAM-02 feeds VIDEO-02 and MIC-01 is the input of AUDIO-01 in the Core's selector.
    await bed.pushState(marked(bed.state, { 'CAM-02': { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' }, 'MIC-01': { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' }, 'CAM-01': { sourceClass: 'PRODUCTION', adapter: 'ONVIF_RTSP' } }));
    expect(badged()).toEqual(['VIDEO-02', 'AUDIO-01']);
    expect(textOf('home-device-VIDEO-02-source-kind')).toBe('Test source');
    expect(textOf('home-device-AUDIO-01-source-kind')).toBe("Core Mac's microphone");

    await bed.pushState(marked(bed.state, {}));
    expect(badged()).toEqual([]);
    expect(getMissingKeys()).toEqual([]);
  });
});
