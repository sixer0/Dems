// Fix wave K Z1 - the one caller of the shared `layoutTransition()` after wave K M1 changed it.
//
// Wave K M1 (gate finding G81b-03, proven on the tablet: implementation/142_fix_wave_k_m1.md
// section 3) made `layoutTransition()` return NOTHING under reduced motion, because on this stack a
// reduced layout transition is skipped without the new frame being applied: the view keeps its old
// size, its lower content lies outside its box and takes no tap. The Home status card
// (`system-status-card.tsx`, `home-status`) is the builder's only caller and its content grows (a
// flag list, the seal-blocked sentence, the recording state). Held here: under reduced motion the
// card carries NO `layout` prop and still draws; under full motion it keeps the re-flow (CONTROL).
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreLinkPrefsForTests } from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { DashboardScreen } from './dashboard-screen';

jest.mock('@shopify/react-native-skia', () =>
  jest
    .requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock')
    .createSkiaMock(),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
  useIsFocused: () => true,
}));

const WINDOWS = { phone: { width: 411, height: 923 }, tablet: { width: 1280, height: 800 } } as const;

async function mount(window: keyof typeof WINDOWS, scenario?: 'recording'): Promise<void> {
  const { width, height } = WINDOWS[window];
  act(() => {
    Dimensions.set({ window: { width, height, scale: 2, fontScale: 1 }, screen: { width, height, scale: 2, fontScale: 1 } });
  });
  const test = createTestSim(scenario ? { scenario } : {});
  expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  renderWithRuntime(<DashboardScreen />, { sim: test.sim });
  await flushAsync();
}

const layoutOfStatus = (): unknown => (screen.getByTestId('home-status').props as { layout?: unknown }).layout;

describe('the Home status card and the shared layout transition', () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  beforeAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetCoreLinkPrefsForTests();
    resetLoopRegistryForTests();
    resetMissingKeys();
  });
  afterEach(() => {
    cleanup();
    resetMotionStateForTests();
    expect(getMissingKeys()).toEqual([]);
  });

  const REDUCED_BY: [string, Parameters<typeof resetMotionStateForTests>[0]][] = [
    ['the `motion=off` link', { linkMotion: 'off' }],
    ['the OS setting', { osReduceMotion: true }],
    ['the in-app switch', { reduceMotionOverride: true }],
  ];

  const CASES = REDUCED_BY.flatMap(([name, state]) => (['phone', 'tablet'] as const).map((window) => [name, window, state] as const));
  it.each(CASES)('reduced by %s, %s: the card has NO `layout` prop and draws its state', async (_name, window, state) => {
    resetMotionStateForTests(state);
    await mount(window);
    expect(layoutOfStatus()).toBeUndefined();
    expect(screen.getByTestId('home-status')).toBeTruthy();
  });

  it('reduced, while a recording runs (the card is a button then): no `layout` prop, the way to Live is there', async () => {
    resetMotionStateForTests({ linkMotion: 'off' });
    await mount('phone', 'recording');
    expect(layoutOfStatus()).toBeUndefined();
    expect(screen.getByTestId('home-status-open-live')).toBeTruthy();
  });

  it('CONTROL: under full motion the card keeps its re-flow transition', async () => {
    resetMotionStateForTests();
    await mount('phone');
    expect(layoutOfStatus()).toBeDefined();
  });
});
