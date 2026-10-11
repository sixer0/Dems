// Fix pass F-M4 (review R69-02; ux spec §8f.3; decision D178) — the Home device tiles say "Core Mac's
// camera is on" / "Core Mac's microphone is on" from the Core's `sourceOpen` fact. LIVE mode on the
// app's own Live source over the contract-checked fake transport (`dashboard/testing/live-home-bed`);
// the fixture SAYS the devices are the Core Mac's local devices and opens nothing (decision D163).
// NOT proven here: a device, a real Core (gate 75).
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, screen, within } from '@testing-library/react-native';
import type { SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests } from '@/runtime';
import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import { createHomeBed, shows, textOf, type HomeBed } from '@/features/dashboard/testing/live-home-bed';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';

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

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('source on home', () => {
unmountBeforeTheHooksOfThisGroup();

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
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-h-no-preview-home.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave H — G70-03 / G75-13 (ruling D196) on the Home device tiles (tablet and phone), LIVE mode on
// the app's own Live source over the contract-checked fake transport (`dashboard/testing/live-home-bed`).
// The fixture SAYS what a Core in real capture sends and opens nothing (decision D163).
// NOT proven here: a device and a real Core (re-gate).
describe('no stock picture on Home', () => {
unmountBeforeTheHooksOfThisGroup();
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
  // Fix wave L (controller ruling on G70c-02): a source at rest of which the Core states no checked fact reads "Not checked" - never "Reachable" / "Ready".
  it('REAL capture: each camera tile is the "No preview" tile with the device name and its true state; no picture, no LIVE / DEMO text', async () => {
    bed = createHomeBed();
    bed.state = marked(bed.state, { 'CAM-01': LOCAL, 'CAM-02': FAKE, 'MIC-01': FAKE, 'MIC-02': FAKE });
    bed.mount(<DashboardScreen />, window);
    await bed.signIn();
    for (const [track, device, state] of [['VIDEO-01', "Core Mac's camera", 'Not checked'], ['VIDEO-02', 'Camera CAM-02', 'Not checked']] as const) {
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
});
