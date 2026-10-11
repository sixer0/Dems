// Task 3 M5, blueprint row 73 (register MB-01, MB-13; ux spec §3.6 "Home tile defect"; backlog B15,
// erratum E-14; D249 observation O-3 and O-RF-T-7): the tablet Home MIC tiles in LIVE mode, on the
// app's own Live source over the contract-checked fake transport (`testing/live-home-bed`).
//
// The defect: the tiles read "No signal" beside a READY chip — while idle, and for a whole recording
// when the app runs under the `?motion=off` test switch (the device runs do). Two causes, both held
// here: (1) the level line took "No signal" from a flat frame, which on an idle Core only means "no
// meter frame yet"; (2) under the test switch the line was read once at mount and then held.
//
// What must stay true: "No signal" IS shown when the Core says the microphone has none.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, screen, within } from '@testing-library/react-native';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, ScenarioName, type AudioFrame, type SimState, hostClockTimeTransition } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests } from '@/runtime';
import { createTestSim } from '@/runtime/testing/test-sim';
import { DashboardScreen } from './dashboard-screen';
import { createHomeBed, flush, label, shows, textOf, type HomeBed } from './testing/live-home-bed';
import { HERO_STILL } from '@/components/media/brand-assets';
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
describe('home mic tiles live', () => {
unmountBeforeTheHooksOfThisGroup();

let bed: HomeBed | null = null;

const frame = (dbfs: number, at: number, seq: number): AudioFrame => ({ seq, at, dbfs, peak: Math.min(0, dbfs + 4), clip: false, noSignal: false });
const flat = (at: number, seq: number): AudioFrame => ({ seq, at, dbfs: -90, peak: -90, clip: false, noSignal: true });
const line = (track: 'AUDIO-01' | 'AUDIO-02') => textOf(`home-device-${track}-dbfs`);
const lines = () => [line('AUDIO-01'), line('AUDIO-02')];
const role = (track: 'AUDIO-01' | 'AUDIO-02') => (shows(`home-device-${track}-role`) ? textOf(`home-device-${track}-role`) : null);

/** The recording session as a Core holds it (the recording scenario of a signed-in engine). */
function recordingSession(now: number): NonNullable<SimState['session']> {
  const engine = createTestSim({ start: now });
  const investigator = OPERATORS[0]!;
  if (!engine.sim.actions.signIn(investigator.username, DEMO_OPERATOR_PASSWORD).ok) throw new Error('the engine could not sign in');
  engine.sim.actions.loadScenario(ScenarioName.RECORDING);
  const session = engine.sim.store.getState().session;
  if (session?.state !== 'RECORDING') throw new Error('the recording scenario did not load');
  return session;
}

async function tabletHome(testSwitch: boolean): Promise<HomeBed> {
  resetMotionStateForTests(testSwitch ? { linkMotion: 'off' } : {});
  bed = createHomeBed();
  bed.mount(<DashboardScreen />, 'tabletLandscape');
  await bed.signIn();
  expect(screen.getByTestId('home-device-AUDIO-01')).toBeTruthy();
  return bed;
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
  resetMotionStateForTests();
  resetLoopRegistryForTests();
  resetMissingKeys();
});

afterEach(() => {
  jest.useRealTimers();
  if (bed !== null) {
    bed.stop();
    bed.fake.assertNoViolations();
    bed = null;
  }
  cleanup();
});

describe('B15: the tablet Home MIC tiles never read "No signal" beside a READY chip', () => {
  it('idle Core, no meter frame yet: the tiles are READY and the level line has no value — not "No signal"', async () => {
    await tabletHome(true);
    expect(label('home-device-AUDIO-01')).toBe('MIC 1, READY');
    expect(label('home-device-AUDIO-02')).toBe('MIC 2, READY');
    expect(lines()).toEqual(['— dBFS', '— dBFS']);
    expect(role('AUDIO-01')).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });

  it('under the `?motion=off` test switch (as the device runs): a recording starts and the tiles show the level of each input, with "Active" / "Standby"', async () => {
    const b = await tabletHome(true);
    const now = b.fake.clock.now();
    await b.pushState({ ...b.state, session: recordingSession(now) });
    b.sendMeters({ 'MIC-01': frame(-18, now, 1), 'MIC-02': frame(-42, now, 1) });
    await flush();
    // Was: "No signal" on both tiles for the whole recording (D249 O-3).
    expect(lines()).toEqual(['-18 dBFS', '-42 dBFS']);
    expect(screen.getByTestId('home-device-AUDIO-01-meter').props.accessibilityValue).toMatchObject({ now: -18, text: '-18 dBFS' });
    expect([role('AUDIO-01'), role('AUDIO-02')]).toEqual(['Active', 'Standby']);

    // The test switch still holds the number between flips (uiautomator idle): later frames do not move it.
    b.sendMeters({ 'MIC-01': frame(-9, now + 50, 2), 'MIC-02': frame(-30, now + 50, 2) });
    await b.elapse(3_000, 500);
    expect(lines()).toEqual(['-18 dBFS', '-42 dBFS']);
    expect(lines().some((text) => /no signal/i.test(text))).toBe(false);
  });

  it('without the test switch: the level follows the frames at 1 Hz, and never reads "No signal" while the Core says READY', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
    const b = await tabletHome(false);
    const now = b.fake.clock.now();
    await b.pushState({ ...b.state, session: recordingSession(now) });
    b.sendMeters({ 'MIC-01': frame(-18, now, 1), 'MIC-02': frame(-42, now, 1) });
    await act(async () => {
      jest.advanceTimersByTime(1_100);
      for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
    });
    expect(lines()).toEqual(['-18 dBFS', '-42 dBFS']);
    b.sendMeters({ 'MIC-01': frame(-9, now + 50, 2), 'MIC-02': frame(-30, now + 50, 2) });
    await act(async () => {
      jest.advanceTimersByTime(1_100);
      for (let turn = 0; turn < 40; turn += 1) await Promise.resolve();
    });
    expect(lines()).toEqual(['-9 dBFS', '-30 dBFS']);
  });

  it('"No signal" is still said when the Core says so: the microphone\'s state, with the chip agreeing', async () => {
    const b = await tabletHome(true);
    const now = b.fake.clock.now();
    await b.pushState({ ...b.state, session: recordingSession(now) });
    b.sendMeters({ 'MIC-01': frame(-18, now, 1), 'MIC-02': frame(-42, now, 1) });
    await flush();
    await b.pushState({ ...b.state, mics: b.state.mics.map((mic) => (mic.id === 'AUDIO-01' ? { ...mic, state: 'NO_SIGNAL' as const } : mic)) });
    b.sendMeters({ 'MIC-01': flat(now + 100, 2), 'MIC-02': frame(-42, now + 100, 2) });
    await flush();
    expect(label('home-device-AUDIO-01')).toBe('MIC 1, NO SIGNAL');
    expect(lines()).toEqual(['No signal', '-42 dBFS']);
    // A flat frame alone, on a microphone the Core calls READY, is not "No signal".
    await b.pushState({ ...b.state, mics: b.state.mics.map((mic) => (mic.id === 'AUDIO-01' ? { ...mic, state: 'READY' as const } : mic)) });
    expect(label('home-device-AUDIO-01')).toBe('MIC 1, READY');
    expect(line('AUDIO-01')).toBe('— dBFS');
  });
});

describe('MB-01: the tiles say which input is active while a session records (ux §3.6; D105)', () => {
  it('the words follow the session\'s pair from the Core and leave with the recording', async () => {
    const b = await tabletHome(true);
    const now = b.fake.clock.now();
    const session = recordingSession(now);
    await b.pushState({ ...b.state, session });
    expect([role('AUDIO-01'), role('AUDIO-02')]).toEqual(['Active', 'Standby']);

    // Another console switched (operation 81): the session slice carries the new pair.
    await b.pushState({
      ...b.state,
      session: { ...session, audioSource: { sessionId: session.id, activeInputId: 'MIC-02', standbyInputId: 'MIC-01', switchedAt: now + 5_000, intervalFromMs: 5_000 } },
    });
    expect([role('AUDIO-01'), role('AUDIO-02')]).toEqual(['Standby', 'Active']);

    await b.pushState({ ...b.state, session: null });
    expect([role('AUDIO-01'), role('AUDIO-02')]).toEqual([null, null]);
    expect(getMissingKeys()).toEqual([]);
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-i-c-home-real-capture.test.tsx` (test-suite consolidation, D233): every case as it was.
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
describe('Home on a Core in real capture', () => {
unmountBeforeTheHooksOfThisGroup();
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
    // Fix wave L (controller ruling on G70c-02): a source at rest of which the Core states no checked fact reads "Not checked" - never "Reachable" / "Ready".
    expect(label('home-device-AUDIO-02')).toBe('MIC 2, Not checked');
    expect(label('home-device-AUDIO-01-state-chip')).toBe('Not reachable');
  });

  // "Not checked" (`checkedAt: null`, a PLANNED member the contract-checked transport of this bed does not
  // carry yet) is held on the pure rule: `capture-selector/source-state.test.ts`.

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
    expect(label('home-device-AUDIO-02')).toBe('MIC 2, Not checked');
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
});
