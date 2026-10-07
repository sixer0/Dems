// Backend task W66 (plan row W66, client gate CLG b; 04_client_integration_spec §3.2 MD-8, MD-9, §3.5,
// §7.4; AC-C-30, AC-C-48; gateway_check/09_cp_mobile_runtime §4 answer 3, 09a §10): Home in LIVE mode,
// drawn on the app's own Live source over the contract-checked fake transport (`testing/live-home-bed`).
//
// Home is display only. What is held here: the Core link chip reads "Live" and sits in the header of
// every layout class (MD-9); nothing on the screen claims a simulation; the data is the Core's; an
// outage turns the chip "Offline" by the runtime's one rule and back, without a flicker during the
// reconnect attempts; the recent rows show no bundled poster the Core did not name
// (RESIDUAL-W66-1, W83 ledger #41); and the one fire-and-forget call (operation 70, acknowledge an alert) goes
// to the Core, with a denial and an outage worded by the refusal presenter. Simulated mode is
// `dashboard-screen.test.tsx`'s, unchanged; its HEARTBEAT chip is at the end of this file.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, screen } from '@testing-library/react-native';
import { refusal, OUTAGE } from '@dems/shared/live/testing';
import { DEMO_OPERATOR_PASSWORD, selectSealedToday } from '@dems/shared/sim';
import { HERO_STILL } from '@/components/media/brand-assets';
import { demoMediaForEvidence } from '@/components/media/demo-media';
import { getMissingKeys, i18n, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { initialsFor, resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests, setCoreLinkSource } from '@/runtime';
import { FakeHeartbeatSocket, createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { MoreScreen } from '@/features/more/more-screen';
import { DashboardScreen } from './dashboard-screen';
import { idSuffix } from './home-model';
import {
  ALERT,
  OPERATOR,
  REFUSE_AFTER_MS,
  createHomeBed,
  flush,
  label,
  layoutAncestors,
  setWindow,
  shows,
  stubMeasure,
  textOf,
  toneOf,
  wordsUnder,
  type HomeBed,
  type WindowName,
} from './testing/live-home-bed';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-keep-awake', () => ({
  useKeepAwake: () => undefined,
  activateKeepAwakeAsync: jest.fn(async () => undefined),
  deactivateKeepAwake: jest.fn(async () => undefined),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
}));

const LAYOUTS: readonly WindowName[] = ['phonePortrait', 'phoneLandscape', 'tabletPortrait', 'tabletLandscape'];
/** Copy that would claim a simulation (§3.2: a screen that shows server data says nothing about one). */
const SIMULATION_WORDING = /simulat|mock-core/i;

let bed: HomeBed | null = null;

async function signedInHome(window: WindowName = 'phonePortrait', options: Parameters<typeof createHomeBed>[0] = {}): Promise<HomeBed> {
  bed = createHomeBed(options);
  bed.mount(<DashboardScreen />, window);
  await bed.signIn();
  expect(screen.getByTestId('bed-probe').props.children).toMatch(/^auth=\S+ link=LIVE\/ONLINE\/LIVE$/);
  expect(screen.getByTestId('screen-home')).toBeTruthy();
  return bed;
}

const chip = () => ({ text: textOf('home-core-link'), label: label('home-core-link'), tone: toneOf('home-core-link') });

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
  mockPush.mockClear();
});

afterEach(() => {
  if (bed !== null) {
    bed.stop();
    bed.fake.assertNoViolations();
    bed = null;
  }
  cleanup();
});

describe('Home in LIVE mode: the Core link chip (MD-8, MD-9, AC-C-30)', () => {
  it('reads "Core Live" in the header of every layout class, and nothing on the screen claims a simulation', async () => {
    const home = await signedInHome();
    for (const window of LAYOUTS) {
      home.setWindow(window);
      await flush();
      expect([window, chip()]).toEqual([window, { text: 'Core Live', label: 'Core link: Live (Live)', tone: 'success' }]);
      const claims = wordsUnder('screen-home').filter((word) => SIMULATION_WORDING.test(word));
      expect([window, claims]).toEqual([window, []]);
    }
    expect(getMissingKeys()).toEqual([]);
  });

  it('shows the Core\'s data: the operator of the session, the Core\'s recent sessions, and a brand still where no poster was named (RESIDUAL-W66-1)', async () => {
    const home = await signedInHome();
    // The Core's snapshot is not a new seal: Home's "new seal" toast (§7.3) does not fire on sign-in,
    // although the Core holds items sealed today (the control).
    expect(selectSealedToday(home.state)).toBeGreaterThan(0);
    expect(screen.queryAllByText(/^Evidence EV-\S+ sealed$/)).toHaveLength(0);
    // The avatar is the operator of the Core's session (not the simulator's "BS").
    expect(screen.getByTestId('bed-probe').props.children).toContain(`auth=${OPERATOR.id} `);
    expect(textOf('home-avatar')).toBe(initialsFor(OPERATOR.displayName));
    const newest = [...home.state.sessionHistory].sort((a, b) => b.endedAt - a.endedAt)[0]!;
    expect(textOf('home-recent-row-0-id')).toBe(newest.evidenceId ?? newest.id);
    // The Simulated screen joins a bundled poster on the evidence number, and this row's number has
    // one (the control); in LIVE no row gets one, because the Core named none.
    expect(demoMediaForEvidence(idSuffix(newest.evidenceId)!)?.poster['VIDEO-01']).toBeDefined();
    for (const index of [0, 1, 2]) {
      expect([screen.getByTestId(`home-recent-row-${index}-thumb`).props.source].flat()).toEqual([HERO_STILL]);
    }
  });

  it('an outage: "Core Offline" at the first down state, kept through every reconnect attempt, "Core Live" at the first heartbeat; the last state stays on screen', async () => {
    const home = await signedInHome();
    expect(chip().text).toBe('Core Live');
    const lastRow = textOf('home-recent-row-0-id');
    const samples: { beat: string; chip: string }[] = [];
    const sample = () => samples.push({ beat: home.heartbeats[home.heartbeats.length - 1] ?? '-', chip: chip().text });

    home.goDown();
    await flush();
    sample();
    expect(chip()).toEqual({ text: 'Core Offline', label: 'Core link: Offline (Live)', tone: 'danger' });
    await home.elapse(12_000, 250, sample);
    // The screen keeps what the Core sent last (§3.5).
    expect(textOf('home-recent-row-0-id')).toBe(lastRow);
    home.comeBack();
    await home.elapse(10_000, 250, sample);

    expect(chip()).toEqual({ text: 'Core Live', label: 'Core link: Live (Live)', tone: 'success' });
    const words = samples.map((entry) => entry.chip);
    expect(words[0]).toBe('Core Offline');
    // Reconnect attempts happened while the server was away (the bed holds each one CONNECTING for a moment) …
    const outage = samples.slice(0, samples.findIndex((entry) => entry.beat === 'LIVE/LIVE'));
    expect(outage.some((entry) => entry.beat === 'LIVE/CONNECTING')).toBe(true);
    expect(outage.some((entry) => entry.beat === 'LIVE/OFFLINE')).toBe(true);
    expect(REFUSE_AFTER_MS).toBeGreaterThan(250);
    // … and none of them made the chip flicker: one change on the way down (before the samples), one on the way back.
    expect(outage.every((entry) => entry.chip === 'Core Offline')).toBe(true);
    const changes = words.filter((word, index) => index > 0 && word !== words[index - 1]);
    expect(changes).toEqual(['Core Live']);
  });
});

describe('Home and More under React StrictMode (controller note F69-1, decision D158)', () => {
  it('mounted twice by StrictMode, neither screen starts a Core command or query: the log holds the session\'s own operations only', async () => {
    bed = createHomeBed({ alerts: [ALERT] });
    bed.mount(
      <>
        <DashboardScreen />
        <MoreScreen />
      </>,
      'phonePortrait',
      { strict: true },
    );
    await bed.signIn();
    expect(screen.getByTestId('screen-home')).toBeTruthy();
    expect(screen.getByTestId('screen-more')).toBeTruthy();
    await bed.elapse(3_000, 500);
    const sent = [...new Set(bed.fake.log.operationIds())].sort();
    expect(sent.filter((operationId) => !['getAuthSession', 'getDeviceRegistration', 'getSignInStatus', 'signIn', 'touchSession'].includes(operationId))).toEqual([]);
    // The one Core call of the two folders is a press, never an effect.
    expect(bed.requestsOf('acknowledgeAlert')).toHaveLength(0);
    expect(textOf('home-bell-count')).toBe('1');
    expect(screen.queryAllByText(/^Evidence EV-\S+ sealed$/)).toHaveLength(0);
  });
});

describe('Home in LIVE mode: acknowledging an alert (operation 70, fire-and-forget; AC-C-48)', () => {
  async function openBell(): Promise<void> {
    expect(textOf('home-bell-count')).toBe('1');
    stubMeasure('home-bell');
    fireEvent.press(screen.getByTestId('home-bell'));
    await flush();
    layoutAncestors(`home-alert-${ALERT.id}`);
  }
  const acknowledgeButton = () => screen.getByText(i18n.t('common.actions.acknowledge'));

  it('success: the request goes to the Core and the bell clears when the Core\'s delta arrives', async () => {
    const home = await signedInHome('phonePortrait', { alerts: [ALERT] });
    await openBell();
    fireEvent.press(acknowledgeButton());
    await flush();
    expect(home.requestsOf('acknowledgeAlert').map((call) => [call.method, call.params['id']])).toEqual([['POST', ALERT.id]]);
    expect(screen.queryByTestId('home-bell-count')).toBeNull();
    expect(screen.queryAllByText('Not permitted')).toHaveLength(0);
  });

  it('a denial (403 NOT_PERMITTED): the denied toast, the alert stays unacknowledged and its button can be pressed again', async () => {
    const home = await signedInHome('phonePortrait', { alerts: [ALERT] });
    // RESIDUAL-W66-2 (W83 ledger #42): operation 70 has no `notPermitted` example (every signed-in role may call it), so the envelope is written here.
    home.fake.answerOnce('acknowledgeAlert', refusal(403, 'NOT_PERMITTED', 'Not permitted.'));
    await openBell();
    fireEvent.press(acknowledgeButton());
    await flush();
    expect(screen.queryAllByText('Not permitted').length).toBeGreaterThan(0);
    expect(textOf('home-bell-count')).toBe('1');
    // The control is back to idle: a second press is a second request.
    fireEvent.press(acknowledgeButton());
    await flush();
    expect(home.requestsOf('acknowledgeAlert')).toHaveLength(2);
    expect(screen.queryByTestId('home-bell-count')).toBeNull();
  });

  it('an outage on the request: the presenter\'s one "Core server unreachable" toast; nothing else happens', async () => {
    const home = await signedInHome('phonePortrait', { alerts: [ALERT] });
    home.fake.answerOnce('acknowledgeAlert', OUTAGE);
    await openBell();
    fireEvent.press(acknowledgeButton());
    await flush();
    expect(screen.queryAllByText('Core server unreachable').length).toBeGreaterThan(0);
    expect(textOf('home-bell-count')).toBe('1');
    expect(home.requestsOf('acknowledgeAlert')).toHaveLength(1);
  });
});

describe('Home in SIMULATED and HEARTBEAT mode: the chip says "Simulated" and keeps its place (MD-8, MD-9)', () => {
  it('SIMULATED: no chip on phones and tablet portrait, "Core Simulated" on the expanded header (as before)', async () => {
    const test = createTestSim();
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    setWindow('phonePortrait');
    renderWithRuntime(<DashboardScreen />, { sim: test.sim });
    await flushAsync();
    for (const window of LAYOUTS) {
      setWindow(window);
      await flushAsync();
      if (window === 'tabletLandscape') expect(chip()).toEqual({ text: 'Core Simulated', label: 'Core link: Simulated (Simulated)', tone: 'info' });
      else expect([window, shows('home-core-link')]).toEqual([window, false]);
    }
    // The recent rows still join the bundled poster on the evidence number (D61), as before.
    const evidenceId = textOf('home-recent-row-0-id');
    const poster = demoMediaForEvidence(idSuffix(evidenceId)!)?.poster['VIDEO-01'];
    expect(poster).toBeDefined();
    expect([screen.getByTestId('home-recent-row-0-thumb').props.source].flat()).toEqual([poster]);
  });

  it('HEARTBEAT: "Core Simulated" while mock-core beats (it read "Live" before, MD-8), "Core Offline" when it is gone', async () => {
    setCoreLinkSource('HEARTBEAT');
    const test = createTestSim();
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    setWindow('tabletLandscape');
    const sockets: FakeHeartbeatSocket[] = [];
    renderWithRuntime(<DashboardScreen />, { sim: test.sim, sockets });
    await flushAsync();
    act(() => sockets[sockets.length - 1]!.beat(1));
    expect(chip()).toEqual({ text: 'Core Simulated', label: 'Core link: Simulated (mock-core heartbeat)', tone: 'info' });
    act(() => sockets[sockets.length - 1]!.drop());
    expect(chip()).toEqual({ text: 'Core Offline', label: 'Core link: Offline (mock-core heartbeat)', tone: 'danger' });
    // Phones keep their header without the chip in HEARTBEAT mode too (MD-9).
    setWindow('phonePortrait');
    await flushAsync();
    expect(shows('home-core-link')).toBe(false);
  });
});
