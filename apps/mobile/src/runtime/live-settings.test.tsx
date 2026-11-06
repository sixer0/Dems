// Backend task W51: what MD-3 does to a screen this row does not write. Settings → App Preferences
// builds its "Core link source" control from `CORE_LINK_SOURCES`, and since 2026-11-05 that list is
// LIVE only: the device has one source, so the control has one segment. This file holds what the
// runtime owes that screen: the segment has its text, a release build shows it not at all, and
// nothing else of the control moved. The confirmation dialog and the sign-out of a change across
// the LIVE boundary (04_client_integration_spec §3.3) are the Settings row's and are not tested
// here: the segment is not pressed.
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { SettingsSectionScreen } from '@/features/settings/settings-section-screen';
import { resetSettingsPrefsForTests } from '@/features/settings/settings-prefs';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { CORE_LINK_SOURCES, resetCoreLinkPrefsForTests } from './core-link';
import { createTestSim, flushAsync, renderWithRuntime } from './testing/test-sim';

jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...jest.requireActual<Record<string, unknown>>('@gorhom/bottom-sheet/mock'),
}));
const mockRouter = { push: jest.fn(), setParams: jest.fn(), back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useIsFocused: () => true,
}));

type DevGlobal = typeof globalThis & { __DEV__: boolean };
const devGlobal = globalThis as DevGlobal;
const originalDev = devGlobal.__DEV__;

async function mountPreferences() {
  act(() => {
    Dimensions.set({ window: { width: 411, height: 923, scale: 2, fontScale: 1 }, screen: { width: 411, height: 923, scale: 2, fontScale: 1 } });
  });
  const test = createTestSim();
  expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  renderWithRuntime(<SettingsSectionScreen section="preferences" />, { sim: test.sim });
  await flushAsync();
}

describe('Settings → Core link source, with LIVE in the list (MD-3)', () => {
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

  it('debug build: one segment, LIVE, enabled and selected', async () => {
    await mountPreferences();
    expect(CORE_LINK_SOURCES).toEqual(['LIVE']);
    expect(screen.getByTestId('settings-core-link-LIVE')).toHaveTextContent('Live');
    expect(screen.getByTestId('settings-core-link-LIVE').props.accessibilityState?.disabled ?? false).toBe(false);
    expect(screen.queryByTestId('settings-core-link-SIMULATED')).toBeNull();
    expect(screen.queryByTestId('settings-core-link-HEARTBEAT')).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });

  // Fix wave J (N-03, J-P's `developerControlsShown`): REPLACES "release build: the LIVE segment is disabled, like the
  // HEARTBEAT one" - a release build no longer draws the developer's Core link source control at all.
  it('release build: the Core link source control is not drawn', async () => {
    devGlobal.__DEV__ = false;
    await mountPreferences();
    expect(screen.queryByTestId('settings-core-link')).toBeNull();
    expect(screen.queryByTestId('settings-core-link-LIVE')).toBeNull();
    expect(screen.queryByTestId('settings-core-link-HEARTBEAT')).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });
});
