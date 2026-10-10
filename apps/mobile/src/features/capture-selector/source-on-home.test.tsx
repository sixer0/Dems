// Fix pass F-M4 (review R69-02; ux spec §8f.3; decision D178) — the Home device tiles say "Core Mac's
// camera is on" / "Core Mac's microphone is on" from the Core's `sourceOpen` fact. LIVE mode on the
// app's own Live source over the contract-checked fake transport (`dashboard/testing/live-home-bed`);
// the fixture SAYS the devices are the Core Mac's local devices and opens nothing (decision D163).
// NOT proven here: a device, a real Core (gate 75).
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, screen } from '@testing-library/react-native';
import type { SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests } from '@/runtime';
import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import { createHomeBed, shows, textOf, type HomeBed } from '@/features/dashboard/testing/live-home-bed';

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
const TILES = ['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02'] as const;
const on = () => TILES.filter((track) => shows(`home-device-${track}-source-on`));

function marked(state: SimState, marks: Readonly<Record<string, Mark>>): SimState {
  return {
    ...state,
    captureDevices: {
      ...state.captureDevices,
      devices: state.captureDevices.devices.map((device) => {
        const { sourceClass: _sourceClass, adapter: _adapter, sourceOpen: _sourceOpen, ...bare } = device as typeof device & { sourceClass?: string; adapter?: string; sourceOpen?: boolean };
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

const LOCAL: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' };

describe('Home tiles: the "is on" state of the Core Mac\'s devices (LIVE)', () => {
  it('absent or false `sourceOpen`: the badge only; true: the fixed line on exactly those tiles; a test source that is open: nothing', async () => {
    bed = createHomeBed();
    // CAM-01 feeds VIDEO-01 and MIC-01 is the input of AUDIO-01 in the Core's selector.
    bed.state = marked(bed.state, { 'CAM-01': LOCAL, 'MIC-01': LOCAL });
    bed.mount(<DashboardScreen />, 'tabletLandscape');
    await bed.signIn();
    // CONTROL: the badge is drawn, the Core sent no `sourceOpen`.
    expect(shows('home-device-VIDEO-01-source')).toBe(true);
    expect(on()).toEqual([]);

    await bed.pushState(marked(bed.state, { 'CAM-01': { ...LOCAL, sourceOpen: true }, 'MIC-01': { ...LOCAL, sourceOpen: true } }));
    expect(on()).toEqual(['VIDEO-01', 'AUDIO-01']);
    expect(textOf('home-device-VIDEO-01-source-on')).toBe("Core Mac's camera is on");
    expect(textOf('home-device-AUDIO-01-source-on')).toBe("Core Mac's microphone is on");

    await bed.pushState(marked(bed.state, { 'CAM-01': { ...LOCAL, sourceOpen: false }, 'MIC-01': LOCAL }));
    expect(on()).toEqual([]);

    await bed.pushState(marked(bed.state, { 'CAM-01': { sourceClass: 'DEVELOPMENT', adapter: 'FAKE', sourceOpen: true }, 'MIC-01': LOCAL }));
    expect(on()).toEqual([]);
    expect(screen.queryByText("Core Mac's camera is on")).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });
});
