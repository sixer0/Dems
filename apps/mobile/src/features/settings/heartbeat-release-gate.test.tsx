// Release builds are Simulated-only (06_packaging_spec §2.6; D112, step 94): the Heartbeat Core-link
// option is a debug-build option. Jest runs with `__DEV__ === true` (react-native's jest setup), so the
// release case flips the global for the test and restores it afterwards. The Settings screen renders
// inside the real AppProviders with an injected, hydrated test simulator (step 73's harness), as in
// settings-screen.test.tsx.
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, renderHook, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { MOBILE_PREFS_KEY, resetMotionStateForTests } from '@/motion';
import {
  effectiveCoreLinkSource,
  hydrateCoreLinkSource,
  isCoreLinkSourceAvailable,
  resetCoreLinkPrefsForTests,
  setCoreLinkSource,
  useCoreLinkSource,
} from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { resetSettingsPrefsForTests } from './settings-prefs';
import { SettingsSectionScreen } from './settings-section-screen';

jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...jest.requireActual<Record<string, unknown>>('@gorhom/bottom-sheet/mock'),
}));

const mockRouter = {
  push: jest.fn(),
  setParams: jest.fn(),
  back: jest.fn(),
  navigate: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn(() => true),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useIsFocused: () => true,
}));

type DevGlobal = typeof globalThis & { __DEV__: boolean };
const devGlobal = globalThis as DevGlobal;
const originalDev = devGlobal.__DEV__;

function asReleaseBuild() {
  devGlobal.__DEV__ = false;
}

async function storedPrefs(): Promise<Record<string, unknown>> {
  return JSON.parse((await AsyncStorage.getItem(MOBILE_PREFS_KEY)) ?? '{}') as Record<string, unknown>;
}

async function mountPreferences() {
  act(() => {
    Dimensions.set({
      window: { width: 411, height: 923, scale: 2, fontScale: 1 },
      screen: { width: 411, height: 923, scale: 2, fontScale: 1 },
    });
  });
  const test = createTestSim();
  expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  renderWithRuntime(<SettingsSectionScreen section="preferences" />, { sim: test.sim });
  await flushAsync();
}

describe('Heartbeat Core link in release builds (06 §2.6, D112)', () => {
  beforeAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  beforeEach(async () => {
    await AsyncStorage.clear();
    resetCoreLinkPrefsForTests();
    resetSettingsPrefsForTests();
    resetMotionStateForTests();
    resetMissingKeys();
  });

  afterEach(() => {
    devGlobal.__DEV__ = originalDev;
    cleanup();
  });

  it('pure gate: Heartbeat only in debug builds; Simulated always; an unavailable choice falls back', () => {
    expect(isCoreLinkSourceAvailable('SIMULATED', false)).toBe(true);
    expect(isCoreLinkSourceAvailable('HEARTBEAT', false)).toBe(false);
    expect(isCoreLinkSourceAvailable('HEARTBEAT', true)).toBe(true);
    expect(effectiveCoreLinkSource('HEARTBEAT', false)).toBe('SIMULATED');
    expect(effectiveCoreLinkSource('HEARTBEAT', true)).toBe('HEARTBEAT');
    // Jest is a debug build: the default follows __DEV__.
    expect(isCoreLinkSourceAvailable('HEARTBEAT')).toBe(true);
  });

  it('release: setCoreLinkSource(HEARTBEAT) is ignored and nothing is written', async () => {
    asReleaseBuild();
    const { result } = renderHook(() => useCoreLinkSource());
    act(() => setCoreLinkSource('HEARTBEAT'));
    await flushAsync();
    expect(result.current).toBe('SIMULATED');
    expect(await storedPrefs()).not.toHaveProperty('coreLinkSource');
  });

  it('release: a HEARTBEAT value stored by a debug build hydrates as SIMULATED', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ coreLinkSource: 'HEARTBEAT' }));
    asReleaseBuild();
    const { result } = renderHook(() => useCoreLinkSource());
    await act(async () => {
      await hydrateCoreLinkSource();
    });
    expect(result.current).toBe('SIMULATED');
  });

  // Fix wave J (JA2-29, N-03; replaces "shows the Heartbeat option disabled with the developer-only hint"):
  // a release build shows NO Core link control. The source gate of the two tests above is unchanged, so
  // a stored or a programmatic HEARTBEAT still cannot take effect.
  it('release: Settings does not show the Core link source at all, and nothing is written', async () => {
    asReleaseBuild();
    await mountPreferences();
    expect(screen.queryByTestId('settings-core-link-SIMULATED')).toBeNull();
    expect(screen.queryByTestId('settings-core-link-HEARTBEAT')).toBeNull();
    expect(screen.queryByText(/developer setup only|mock-core|Core link source/i)).toBeNull();
    await flushAsync();
    expect(await storedPrefs()).not.toHaveProperty('coreLinkSource');
    expect(getMissingKeys()).toEqual([]);
  });

  it('debug: the Heartbeat option stays enabled (dev lanes unchanged)', async () => {
    await mountPreferences();
    const heartbeat = screen.getByTestId('settings-core-link-HEARTBEAT');
    expect(heartbeat.props.accessibilityState?.disabled ?? false).toBe(false);
    expect(screen.queryByText(/developer setup only/i)).toBeNull();
    fireEvent.press(heartbeat);
    await flushAsync();
    expect(await storedPrefs()).toMatchObject({ coreLinkSource: 'HEARTBEAT' });
  });
});
