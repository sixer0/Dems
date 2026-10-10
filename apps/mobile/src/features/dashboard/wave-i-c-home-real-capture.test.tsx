// Fix wave I, driver C - Home (tablet and phone) on a Core in REAL capture, LIVE mode on the app's own
// Live source over the contract-checked fake transport (`testing/live-home-bed`). The fixture SAYS what
// such a Core sends and opens nothing (decision D163).
//
// | Finding | Seen at the re-gate | Held here |
// |---|---|---|
// | G70b-04 / G75b-09 | "Recent Sessions" rows drew the stock room picture as their thumb on the real-capture lane | REAL capture: each row's thumb is the neutral "No preview" thumb (the rule of the tiles, ruling D196), no picture; a Core in SIMULATED capture and the in-app simulator keep their pictures |
// | G75b-06 (mobile half) | the Home time chip read "GNSS / Time: RTC" on a Core that runs on the host's system clock | the chip states what the `time` slice gives: "Time: Host system clock", with no "GNSS" in its label and no warning tone; a Core that states RTC / NTP / GNSS is worded as before |
// | Home microphone state (controller's post-gate item; contract note A2 §4) | the microphone tile read "Ready" / "Online" from a constant-like track state whatever microphone was selected | REAL capture: the tile of a line states what the Core reported for the microphone ON that line - "Not reachable" when it is offline, "Not checked" when the Core says it has not read it since it started (`checkedAt: null`), "On" only for an open local microphone; the phone's Microphone tile counts the reachable lines and its state follows the PRIMARY line |
//
// NOT proven here: a device and a real Core (re-drive list of note 134).
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, screen, within } from '@testing-library/react-native';
import { hostClockTimeTransition, type SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests } from '@/runtime';
import { HERO_STILL } from '@/components/media/brand-assets';
import { DashboardScreen } from './dashboard-screen';
import { createHomeBed, label, textOf, type HomeBed } from './testing/live-home-bed';

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
type Mark = Record<string, unknown>;
const FAKE: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'FAKE' };
const LOCAL: Mark = { sourceClass: 'DEVELOPMENT', adapter: 'LOCAL_DEVICE' };
const REAL_CAPTURE: Readonly<Record<string, Mark>> = { 'CAM-01': FAKE, 'CAM-02': FAKE, 'MIC-01': FAKE, 'MIC-02': FAKE };

/** What a Core in real capture sends on its capture devices (`sourceClass`; optionally more members of a device). */
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
  expect(getMissingKeys()).toEqual([]);
});

const thumbSource = (index: number): unknown[] => [screen.getByTestId(`home-recent-row-${index}-thumb`).props.source].flat();

describe.each(['tabletLandscape', 'phonePortrait'] as const)('G70b-04 / G75b-09 on %s: Home "Recent Sessions" thumbs', (window) => {
  it('REAL capture: no stock picture - each row has the neutral "No preview" thumb, and still names its session', async () => {
    bed = createHomeBed();
    bed.state = marked(bed.state, REAL_CAPTURE);
    bed.mount(<DashboardScreen />, window);
    await bed.signIn();
    for (const index of [0, 1, 2]) {
      const thumb = screen.getByTestId(`home-recent-row-${index}-thumb`);
      // The neutral thumb is a labelled icon tile, not an image: it has no picture source at all.
      expect(thumb.props.source).toBeUndefined();
      expect(thumb.props.accessibilityLabel).toMatch(/No preview: this build shows no live picture\.$/);
      expect(textOf(`home-recent-row-${index}-id`)).not.toBe('');
    }
    expect(within(screen.getByTestId('home-recent')).queryAllByText(/\b(LIVE|DEMO)\b/)).toHaveLength(0);
  });

  it('CONTROL - a Core in SIMULATED capture (no `sourceClass`): the rows keep their picture, as before', async () => {
    bed = createHomeBed();
    bed.mount(<DashboardScreen />, window);
    await bed.signIn();
    for (const index of [0, 1, 2]) expect(thumbSource(index)).toEqual([HERO_STILL]);
  });
});

describe('G75b-06 (mobile half) on tabletLandscape: the Home time chip states what the Core gives', () => {
  it('a Core on the host system clock: "Time: Host system clock" - no "GNSS", no "RTC", no holdover, no warning tone', async () => {
    bed = createHomeBed();
    bed.state = hostClockTimeTransition(marked(bed.state, REAL_CAPTURE));
    expect(bed.state.time).toMatchObject({ hostClock: true, source: 'RTC', locked: false });
    bed.mount(<DashboardScreen />, 'tabletLandscape');
    await bed.signIn();
    expect(label('home-chip-time')).toBe('Time: Host system clock');
    expect(label('home-chip-time')).not.toMatch(/GNSS|RTC|holdover/i);
    expect(screen.getByTestId('home-chip-time').props.color).not.toBe('warning');
  });

  it('CONTROL - a Core that states RTC without the host-clock fact keeps the reference wording and its warning tone', async () => {
    bed = createHomeBed();
    bed.state = { ...bed.state, time: { ...bed.state.time, source: 'RTC', locked: false } };
    bed.mount(<DashboardScreen />, 'tabletLandscape');
    await bed.signIn();
    expect(label('home-chip-time')).toBe('GNSS / Time: RTC');
  });

  it('CONTROL - GNSS locked reads "GNSS / Time: Synchronized"', async () => {
    bed = createHomeBed();
    bed.mount(<DashboardScreen />, 'tabletLandscape');
    await bed.signIn();
    expect(label('home-chip-time')).toBe('GNSS / Time: Synchronized');
  });
});

describe('Home microphone state in REAL capture: what the Core reported for the microphone on the line', () => {
  it('tablet: the PRIMARY line\'s tile says "Not reachable" when that microphone is offline, the STANDBY line\'s "Reachable"', async () => {
    bed = createHomeBed();
    bed.state = marked(bed.state, { ...REAL_CAPTURE, 'MIC-01': { ...FAKE, online: false } });
    bed.mount(<DashboardScreen />, 'tabletLandscape');
    await bed.signIn();
    expect(label('home-device-AUDIO-01')).toBe('MIC 1, Not reachable');
    expect(label('home-device-AUDIO-02')).toBe('MIC 2, Reachable');
    expect(label('home-device-AUDIO-01-state-chip')).toBe('Not reachable');
  });

  // "Not checked" (`checkedAt: null`, a PLANNED member the contract-checked transport of this bed does not
  // carry yet) is held on the pure rule: `capture-selector/wave-i-c-source-state.test.ts`.

  it('tablet: the tile and its badge follow the SELECTED primary microphone - the Core Mac\'s microphone on the line, not the built-in one', async () => {
    bed = createHomeBed();
    const local = { id: 'MIC-03', kind: 'MIC', model: 'MacBook Air Microphone', firmware: null, host: null, poePort: null, online: false, streamState: null, capabilities: [], ...LOCAL };
    const real = marked(bed.state, REAL_CAPTURE);
    bed.state = {
      ...real,
      captureDevices: { ...real.captureDevices, devices: [...real.captureDevices.devices, local as unknown as (typeof real.captureDevices.devices)[number]] },
      captureConfig: { ...real.captureConfig, mics: real.captureConfig.mics.map((line) => (line.role === 'PRIMARY' ? { ...line, inputId: 'MIC-03', deviceId: 'MIC-03' } : line)) },
    };
    bed.mount(<DashboardScreen />, 'tabletLandscape');
    await bed.signIn();
    // MIC-01 (reachable) is on no line any more: the tile of line 1 says what the Core reported for MIC-03.
    expect(label('home-device-AUDIO-01')).toBe('MIC 1, Not found');
    expect(textOf('home-device-AUDIO-01-source-kind')).toBe("Core Mac's microphone");
    expect(label('home-device-AUDIO-02')).toBe('MIC 2, Reachable');
    // The Core says the microphone is there and open: "On" (the badge beside it carries the fixed sentence).
    await bed.pushState(marked(bed.state, { 'MIC-03': { online: true, sourceOpen: true } }));
    expect(label('home-device-AUDIO-01')).toBe('MIC 1, On');
  });

  it('phone: the Microphone tile counts the reachable lines and its state is the PRIMARY line\'s', async () => {
    bed = createHomeBed();
    bed.state = marked(bed.state, { ...REAL_CAPTURE, 'MIC-01': { ...FAKE, online: false } });
    bed.mount(<DashboardScreen />, 'phonePortrait');
    await bed.signIn();
    expect(label('home-tile-microphone-value')).toBe('1/2');
    expect(textOf('home-tile-microphone-state')).toBe('Primary not reachable');
  });

  it('CONTROL - a Core in SIMULATED capture: the tiles read the simulated track state, as before', async () => {
    bed = createHomeBed();
    bed.mount(<DashboardScreen />, 'tabletLandscape');
    await bed.signIn();
    expect(label('home-device-AUDIO-01')).toBe('MIC 1, READY');
    expect(label('home-device-AUDIO-02')).toBe('MIC 2, READY');
  });
});
