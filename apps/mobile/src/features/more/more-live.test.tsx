// Backend task W66 (plan row W66, client gate CLG b; 04_client_integration_spec §3.2 MD-8, §3.5, §7.4;
// AC-C-30; gateway_check/09a §10): More in LIVE mode, drawn on the app's own Live source over the
// contract-checked fake transport (the bed of `features/dashboard/testing/live-home-bed`).
//
// More is display only and calls no Core action. What is held here: the footer's Core link chip
// reads "Live" and the note under it names the Core server instead of simulated data; nothing on the
// screen claims a simulation; the operator card, the pairing row and the console tiles show what the
// Core sent; an outage turns the chip "Offline" by the runtime's one rule and back. Simulated mode is
// `more-screen.test.tsx`'s, unchanged; its HEARTBEAT chip is at the end of this file.
import 'react-native-gesture-handler/jestSetup';
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, screen } from '@testing-library/react-native';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { CORE_NAME, OPERATOR, createHomeBed, flush, label, setWindow, textOf, toneOf, wordsUnder, type HomeBed, type WindowName } from '@/features/dashboard/testing/live-home-bed';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreErrorPresenterForTests, resetCoreLinkPrefsForTests, resetDebugLaunchForTests, setCoreLinkSource } from '@/runtime';
import { FakeHeartbeatSocket, createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { MoreScreen } from './more-screen';

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

const LAYOUTS: readonly WindowName[] = ['phonePortrait', 'phoneLandscape', 'tabletPortrait', 'tabletLandscape'];
const SIMULATION_WORDING = /simulat|mock-core/i;

let bed: HomeBed | null = null;

async function signedInMore(window: WindowName = 'phonePortrait'): Promise<HomeBed> {
  bed = createHomeBed();
  bed.mount(<MoreScreen />, window);
  await bed.signIn();
  expect(screen.getByTestId('bed-probe').props.children).toBe(`auth=${OPERATOR.id} link=LIVE/ONLINE/LIVE`);
  expect(screen.getByTestId('screen-more')).toBeTruthy();
  return bed;
}

const chip = () => ({ text: textOf('more-core-link'), label: label('more-core-link'), tone: toneOf('more-core-link') });

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
  if (bed !== null) {
    bed.stop();
    bed.fake.assertNoViolations();
    bed = null;
  }
  cleanup();
});

describe('More in LIVE mode (MD-8, AC-C-30, §3.2)', () => {
  // RC-8 (row 19): the W93-17 explicit 20 s budget is removed — T1 set testTimeout: 20000 globally
  // (jest.config.js:10), so the per-test budget equalled the default and changed nothing (D239, D255).
  it('the footer reads "Core Live" and names the Core server as the source of the data; nothing claims a simulation, in any layout class', async () => {
    const more = await signedInMore();
    for (const window of LAYOUTS) {
      more.setWindow(window);
      await flush();
      expect([window, chip()]).toEqual([window, { text: 'Core Live', label: 'Core link: Live (Live)', tone: 'success' }]);
      expect([window, textOf('more-footer-note')]).toEqual([window, 'Data from the Core server']);
      const claims = wordsUnder('screen-more').filter((word) => SIMULATION_WORDING.test(word));
      expect([window, claims]).toEqual([window, []]);
    }
    expect(getMissingKeys()).toEqual([]);
  });

  it('shows the Core\'s data: the operator of the session, the pairing with the Core\'s own name, the audit count of the replica', async () => {
    const more = await signedInMore();
    expect(textOf('more-operator-name')).toBe(OPERATOR.displayName);
    expect(textOf('more-operator-id')).toBe(OPERATOR.id);
    expect(textOf('more-link-pairing-detail')).toBe(`Core: ${CORE_NAME}`);
    expect(textOf('more-link-pairing-chip')).toBe('Paired');
    const count = more.state.audit.rows.length;
    expect(textOf('more-dest-audit-detail')).toBe(`${count} ${count === 1 ? 'event' : 'events'}`);
  });

  it('an outage: "Core Offline" at the first down state, kept through the reconnect attempts, "Core Live" again at the first heartbeat', async () => {
    const more = await signedInMore();
    const words: string[] = [];
    const beats: string[] = [];
    const sample = () => {
      words.push(chip().text);
      beats.push(more.heartbeats[more.heartbeats.length - 1] ?? '-');
    };
    more.goDown();
    await flush();
    sample();
    await more.elapse(12_000, 250, sample);
    expect(beats).toContain('LIVE/CONNECTING');
    expect(words.slice(0, beats.length).every((word) => word === 'Core Offline')).toBe(true);
    expect(chip()).toEqual({ text: 'Core Offline', label: 'Core link: Offline (Live)', tone: 'danger' });
    more.comeBack();
    await more.elapse(10_000, 250, sample);
    expect(chip()).toEqual({ text: 'Core Live', label: 'Core link: Live (Live)', tone: 'success' });
    expect(words.filter((word, index) => index > 0 && word !== words[index - 1])).toEqual(['Core Live']);
    // More called no Core action: only the reads of the start, the sign-in and the session's own upkeep went out.
    const sent = new Set(more.fake.log.operationIds());
    for (const operationId of sent) expect(['getAuthSession', 'getSignInStatus', 'getDeviceRegistration', 'signIn', 'touchSession']).toContain(operationId);
  });
});

describe('More in SIMULATED and HEARTBEAT mode (MD-8)', () => {
  it('SIMULATED: "Core Simulated" and the note about simulated data, as before', async () => {
    const test = createTestSim();
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    setWindow('phonePortrait');
    renderWithRuntime(<MoreScreen />, { sim: test.sim });
    await flushAsync();
    expect(chip()).toEqual({ text: 'Core Simulated', label: 'Core link: Simulated (Simulated)', tone: 'info' });
    expect(textOf('more-footer-note')).toBe('Simulated data for demonstration');
  });

  it('HEARTBEAT: "Core Simulated" while mock-core beats (it read "Live" before, MD-8), "Core Offline" when it is gone', async () => {
    setCoreLinkSource('HEARTBEAT');
    const test = createTestSim();
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    setWindow('phonePortrait');
    const sockets: FakeHeartbeatSocket[] = [];
    renderWithRuntime(<MoreScreen />, { sim: test.sim, sockets });
    await flushAsync();
    act(() => sockets[sockets.length - 1]!.beat(1));
    expect(chip()).toEqual({ text: 'Core Simulated', label: 'Core link: Simulated (mock-core heartbeat)', tone: 'info' });
    expect(textOf('more-footer-note')).toBe('Simulated data for demonstration');
    act(() => sockets[sockets.length - 1]!.drop());
    expect(chip()).toEqual({ text: 'Core Offline', label: 'Core link: Offline (mock-core heartbeat)', tone: 'danger' });
  });
});
