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
import { AUDIO_FRAME_NOT_MEASURED_EXAMPLE } from '@dems/shared/api';
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
// Audit row 209 (M3-17, register A3; D134, D138; ruling D189): the tiles name their PAIR - "Mic N (Camera N)" on every
// microphone tile, and the one "Transcribed" chip on Pair 1 - instead of a role word (`home-device-AUDIO-0N-role` is
// gone with op 81). The words are fixed by channel number (D27), so they do not move with a recording or a switch.
const MIC_TRACKS = ['AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'] as const;
const pairLabel = (track: (typeof MIC_TRACKS)[number]) => (shows(`home-mic-tile-pair-${track}`) ? textOf(`home-mic-tile-pair-${track}`) : null);
const pairWords = () => ({
  labels: MIC_TRACKS.map(pairLabel),
  transcribed: [...new Set(screen.queryAllByTestId(/^home-mic-tile-transcribed-/).map((node) => String(node.props.testID)))],
  transcribedText: shows('home-mic-tile-transcribed-AUDIO-01') ? textOf('home-mic-tile-transcribed-AUDIO-01') : null,
});
/** A3 on the four tablet tiles: the four pair labels and exactly one "Transcribed", on Pair 1 (D134, D138). */
const A3_WORDS = {
  labels: ['Mic 1 (Camera 1)', 'Mic 2 (Camera 2)', 'Mic 3 (Camera 3)', 'Mic 4 (Camera 4)'],
  transcribed: ['home-mic-tile-transcribed-AUDIO-01'],
  transcribedText: 'Transcribed',
};
/** No tile reads a role word (`session.audioSource.role.*`, "Channel N (...)"), D134/D138. */
const noRoleWord = () => MIC_TRACKS.every((track) => !shows(`home-device-${track}-role`));

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
    // Row 209 (M3-17; D134, D138): the four tiles carry the A3 pair words already at rest, and no role word.
    expect(pairWords()).toEqual(A3_WORDS);
    expect(noRoleWord()).toBe(true);
    expect(getMissingKeys()).toEqual([]);
  });

  it('under the `?motion=off` test switch (as the device runs): a recording starts and the tiles show the level of each input, with the pair words (A3; D134, D138)', async () => {
    const b = await tabletHome(true);
    const now = b.fake.clock.now();
    await b.pushState({ ...b.state, session: recordingSession(now) });
    b.sendMeters({ 'MIC-01': frame(-18, now, 1), 'MIC-02': frame(-42, now, 1) });
    await flush();
    // Was: "No signal" on both tiles for the whole recording (D249 O-3).
    expect(lines()).toEqual(['-18 dBFS', '-42 dBFS']);
    expect(screen.getByTestId('home-device-AUDIO-01-meter').props.accessibilityValue).toMatchObject({ now: -18, text: '-18 dBFS' });
    // Row 209 (M3-17; D134, D138). Was the D61 channel words ("Channel 1 (transcribed)", "Channel 2 (recorded)"):
    // the tiles name their pair, and Pair 1 alone says "Transcribed".
    expect(pairWords()).toEqual(A3_WORDS);
    expect(noRoleWord()).toBe(true);

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

describe('JW-08 mobile half, round two: a frame the Core marks `notMeasured` is no level (contract_wave_j.md J-S 6)', () => {
  // Seen on the tablet's Home at rest after the lanes' restart: "-60 dBFS" and a bar meter under "Not checked".
  // The frame's `dbfs` is the floor as a PLACEHOLDER of the required member and `noSignal` is false.
  it.each([[true], [false]])('at rest (test switch %s): "— dBFS" and "Not measured", no meter canvas, never a number', async (testSwitch) => {
    const b = await tabletHome(testSwitch);
    const now = b.fake.clock.now();
    b.sendMeters({ 'MIC-01': { ...AUDIO_FRAME_NOT_MEASURED_EXAMPLE, at: now }, 'MIC-02': { ...AUDIO_FRAME_NOT_MEASURED_EXAMPLE, at: now } });
    await flush();
    expect(lines()).toEqual(['— dBFS', '— dBFS']);
    expect(shows('home-device-AUDIO-01-meter')).toBe(false);
    expect(within(screen.getByTestId('home-device-AUDIO-01-not-measured')).getByText('Not measured')).toBeTruthy();
    expect(lines().some((text) => /\d/.test(text) || /no signal/i.test(text))).toBe(false);
    expect(getMissingKeys()).toEqual([]);
  });

  it('CONTROL - the same microphones once a capture is open: frames without the member read as levels again', async () => {
    const b = await tabletHome(true);
    const now = b.fake.clock.now();
    b.sendMeters({ 'MIC-01': { ...AUDIO_FRAME_NOT_MEASURED_EXAMPLE, at: now }, 'MIC-02': { ...AUDIO_FRAME_NOT_MEASURED_EXAMPLE, at: now } });
    await flush();
    await b.pushState({ ...b.state, session: recordingSession(now) });
    b.sendMeters({ 'MIC-01': frame(-18, now + 100, 2), 'MIC-02': frame(-42, now + 100, 2) });
    await flush();
    expect(lines()).toEqual(['-18 dBFS', '-42 dBFS']);
    expect(shows('home-device-AUDIO-01-meter')).toBe(true);
  });
});

// Re-pinned by audit row 209 (M3-17, register A3; D134, D138; ruling D189). Was MB-01 (ux §3.6; D105): "the tiles say
// which input is active while a session records" - op 81 is retired (D134), the web tiles name the pair (D138).
describe('M3-17 (was MB-01): the tiles name their pair, fixed by channel number, through a recording (A3; D134, D138)', () => {
  it('the pair words hold before, during and after the recording, and a stated audioSource does not move them', async () => {
    const b = await tabletHome(true);
    const now = b.fake.clock.now();
    const session = recordingSession(now);
    await b.pushState({ ...b.state, session });
    expect(pairWords()).toEqual(A3_WORDS);
    expect(noRoleWord()).toBe(true);

    // A session slice that still carries a switched audioSource (an older Core; op 81 is retired, D134): the words stay.
    await b.pushState({
      ...b.state,
      session: { ...session, audioSource: { sessionId: session.id, activeInputId: 'MIC-02', standbyInputId: 'MIC-01', switchedAt: now + 5_000, intervalFromMs: 5_000 } },
    });
    expect(pairWords()).toEqual(A3_WORDS);
    expect(noRoleWord()).toBe(true);

    await b.pushState({ ...b.state, session: null });
    expect(pairWords()).toEqual(A3_WORDS);
    expect(getMissingKeys()).toEqual([]);
  });

  // Task 4 row 171 (site M5; decision C18 (2); D61 of 2026-11-04 generalized D137): the tiles find the input of a
  // channel by the lookup of row 164 - a channel WITHOUT its line has no input, while a held channel records.
  it('task 4 row 171: the selector holds no complete transcription pair - the held channel 1 reads its level, the channels without their line show none; the complete plane brings all back', async () => {
    const b = await tabletHome(true);
    const now = b.fake.clock.now();
    const session = recordingSession(now);
    const complete = b.state.captureConfig;
    const lone = complete.mics.filter((entry) => entry.channel === 'MIC-01'); // D61 (2026-11-04): the line is found by CHANNEL; channels 2..4 stand empty
    const snapshot = (mics: typeof lone) => (session.captureConfig ? { ...session.captureConfig, mics } : session.captureConfig);
    // A session that states no pair, recording under a selector with the channel-1 line only.
    await b.pushState({
      ...b.state,
      captureConfig: { ...complete, mics: lone },
      session: { ...session, audioSource: null, captureConfig: snapshot(lone) } as unknown as NonNullable<SimState['session']>,
    });
    b.sendMeters({ 'MIC-01': frame(-18, now, 1), 'MIC-02': frame(-42, now, 1) });
    await flush();
    // D61: channel 1 names its input and reads its frame; the empty channels have no input and read none.
    expect(lines()).toEqual(['-18 dBFS', '— dBFS']);
    // Row 209 (D134, D138): the pair words do not depend on a line holding the channel (W3T-D3) - all four stand.
    expect(pairWords()).toEqual(A3_WORDS);
    expect(lines().some((text) => /no signal|-42/i.test(text))).toBe(false);

    // CONTROL - the same recording under the complete plane: the levels and the words, as before.
    await b.pushState({ ...b.state, captureConfig: complete, session: { ...session, captureConfig: snapshot(complete.mics) } as NonNullable<SimState['session']> });
    b.sendMeters({ 'MIC-01': frame(-18, now + 50, 2), 'MIC-02': frame(-42, now + 50, 2) });
    await flush();
    expect(lines()).toEqual(['-18 dBFS', '-42 dBFS']);
    expect(pairWords()).toEqual(A3_WORDS); // row 209 (D134, D138): the pair words, was the D61 channel words
    expect(noRoleWord()).toBe(true);
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

  it('tablet: the tile and its badge follow the SELECTED transcribed microphone - the Core Mac\'s microphone on channel 1, not the built-in one', async () => {
    bed = createHomeBed();
    const local = { id: 'MIC-05', kind: 'MIC', model: 'MacBook Air Microphone', firmware: null, host: null, poePort: null, online: false, streamState: null, capabilities: [], ...LOCAL }; // D61 (2026-11-04): MIC-03/04 are built-ins; an adopted microphone mints as MIC-05
    const real = marked(bed.state, REAL_CAPTURE);
    bed.state = {
      ...real,
      captureDevices: { ...real.captureDevices, devices: [...real.captureDevices.devices, local as unknown as (typeof real.captureDevices.devices)[number]] },
      captureConfig: { ...real.captureConfig, mics: real.captureConfig.mics.map((line) => (line.channel === 'MIC-01' ? { ...line, inputId: 'MIC-05', deviceId: 'MIC-05' } : line)) }, // D61: the line is keyed by CHANNEL
    };
    bed.mount(<DashboardScreen />, 'tabletLandscape');
    await bed.signIn();
    // MIC-01 (reachable) is on no line any more: the tile of channel 1 says what the Core reported for MIC-05.
    expect(label('home-device-AUDIO-01')).toBe('MIC 1, Not found');
    expect(textOf('home-device-AUDIO-01-source-kind')).toBe("Core Mac's microphone");
    expect(label('home-device-AUDIO-02')).toBe('MIC 2, Not checked');
    // The Core says the microphone is there and open: "On" (the badge beside it carries the fixed sentence).
    await bed.pushState(marked(bed.state, { 'MIC-05': { online: true, sourceOpen: true } }));
    expect(label('home-device-AUDIO-01')).toBe('MIC 1, On');
  });

  it('phone: the Microphone tile counts the reachable lines and its state is the transcribed channel\'s', async () => {
    bed = createHomeBed();
    bed.state = marked(bed.state, { ...REAL_CAPTURE, 'MIC-01': { ...FAKE, online: false } });
    bed.mount(<DashboardScreen />, 'phonePortrait');
    await bed.signIn();
    expect(label('home-tile-microphone-value')).toBe('3/4'); // D61 (2026-11-04): four channels; MIC-01 is the one the Core reports gone
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
