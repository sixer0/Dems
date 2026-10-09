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
import { act, cleanup, screen } from '@testing-library/react-native';
import { DEMO_OPERATOR_PASSWORD, OPERATORS, ScenarioName, type AudioFrame, type SimState } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests } from '@/runtime';
import { createTestSim } from '@/runtime/testing/test-sim';
import { DashboardScreen } from './dashboard-screen';
import { createHomeBed, flush, label, shows, textOf, type HomeBed } from './testing/live-home-bed';

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
