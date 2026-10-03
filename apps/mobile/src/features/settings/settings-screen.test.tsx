// Settings screens (step 88; 04_mobile_specs §4.15, §2.4, §5.3; D57, D88, Q-M8; MA-11 MB 10 order,
// MA-21 keys, MA-30 demo controls unit part). The screens render inside the real AppProviders with
// an injected, hydrated test simulator (step 73's `renderWithRuntime`); expo-router's hook is
// mocked (step 70's harness covers the route files), and the kit's BottomSheet uses gorhom's mock
// (F-79-2: the real sheet's worklet closure cannot run in Jest).
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { readPresentationMode } from '@/features/login/presentation-mode';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { MOBILE_PREFS_KEY, motionStore, resetMotionStateForTests } from '@/motion';
import { resetCoreLinkPrefsForTests } from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';
import type { SettingsSection } from '@/navigation/params';
import { resetSettingsPrefsForTests } from './settings-prefs';
import { SettingsScreen } from './settings-screen';
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

const WINDOWS = {
  phonePortrait: { width: 411, height: 923 },
  tabletLandscape: { width: 1280, height: 800 },
} as const;

function setWindow(name: keyof typeof WINDOWS) {
  const { width, height } = WINDOWS[name];
  act(() => {
    Dimensions.set({ window: { width, height, scale: 2, fontScale: 1 }, screen: { width, height, scale: 2, fontScale: 1 } });
  });
}

/** Document order of the given testIDs in the rendered tree. */
function orderOf(ids: readonly string[]): string[] {
  const order: string[] = [];
  const walk = (node: ReactTestInstance) => {
    const id = node.props?.testID as string | undefined;
    if (id && ids.includes(id) && !order.includes(id)) order.push(id);
    for (const child of node.children) if (typeof child !== 'string') walk(child);
  };
  walk(screen.UNSAFE_root);
  return order;
}

async function storedPrefs(): Promise<Record<string, unknown>> {
  return JSON.parse((await AsyncStorage.getItem(MOBILE_PREFS_KEY)) ?? '{}') as Record<string, unknown>;
}

interface MountOptions {
  window?: keyof typeof WINDOWS;
  section?: SettingsSection;
  selectedSection?: SettingsSection | null;
  signIn?: boolean;
}

async function mount(options: MountOptions = {}): Promise<TestSim> {
  setWindow(options.window ?? 'phonePortrait');
  const test = createTestSim();
  if (options.signIn !== false) expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  renderWithRuntime(
    options.section ? <SettingsSectionScreen section={options.section} /> : <SettingsScreen selectedSection={options.selectedSection ?? null} />,
    { sim: test.sim },
  );
  await flushAsync();
  return test;
}

describe('Settings', () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  beforeAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  beforeEach(async () => {
    await AsyncStorage.clear();
    resetCoreLinkPrefsForTests();
    resetSettingsPrefsForTests();
    resetMotionStateForTests();
    resetMissingKeys();
    for (const fn of Object.values(mockRouter)) fn.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('phone portrait: MB 10 regions G1–G4 in order, the account row, every row label, 0 missing keys', async () => {
    await mount();
    expect(screen.getByTestId('screen-settings')).toBeTruthy();
    expect(orderOf(['settings-header', 'settings-account', 'settings-group-application', 'settings-group-system'])).toEqual([
      'settings-header',
      'settings-account',
      'settings-group-application',
      'settings-group-system',
    ]);
    expect(screen.getByTestId('settings-header-back')).toBeTruthy();
    const account = screen.getByTestId('settings-account-row');
    expect(account.props.accessibilityLabel).toBe('Investigator, AKP Budi Santoso. Open profile');
    expect(within(account).getByText('BS')).toBeTruthy();
    expect(within(screen.getByTestId('settings-group-application')).getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'App Preferences',
      'Notifications',
      'Security & Privacy',
    ]);
    expect(within(screen.getByTestId('settings-group-system')).getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'Device Settings',
      'Storage Management',
      'Network & Time',
      'System Maintenance',
      'About DEMS',
    ]);
    expect(screen.queryByTestId('pane-categories')).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });

  it('phone: sections push /settings/<section>; System rows open the existing screens; Back goes back', async () => {
    await mount();
    for (const id of ['preferences', 'notifications', 'security', 'devices', 'storage', 'network-time', 'maintenance', 'about']) {
      fireEvent.press(screen.getByTestId(`settings-row-${id}`));
    }
    expect(mockRouter.push.mock.calls.map((call) => call[0])).toEqual([
      '/settings/preferences',
      '/settings/notifications',
      '/settings/security',
      '/devices',
      '/storage',
      '/network-time',
      '/settings/maintenance',
      '/settings/about',
    ]);
    fireEvent.press(screen.getByTestId('settings-header-back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('tablet landscape: categories 320 dp | section pane, App Preferences by default, selection through ?selected=', async () => {
    await mount({ window: 'tabletLandscape' });
    expect(screen.getByTestId('pane-categories')).toBeTruthy();
    const pane = screen.getByTestId('pane-section');
    expect(within(pane).getByTestId('settings-preferences')).toBeTruthy();
    expect(screen.getByTestId('settings-row-preferences').props.accessibilityState).toEqual({ selected: true });
    expect(screen.queryByTestId('settings-header-back')).toBeNull();
    fireEvent.press(screen.getByTestId('settings-row-about'));
    expect(mockRouter.setParams).toHaveBeenCalledWith({ selected: 'about' });
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(getMissingKeys()).toEqual([]);
  });

  it('tablet landscape: ?selected=about opens About in the pane and marks its row', async () => {
    await mount({ window: 'tabletLandscape', selectedSection: 'about' });
    expect(within(screen.getByTestId('pane-section')).getByTestId('settings-about')).toBeTruthy();
    expect(screen.getByTestId('settings-row-about').props.accessibilityState).toEqual({ selected: true });
    expect(getMissingKeys()).toEqual([]);
  });

  it('App Preferences: every switch and choice merges into dems.mobile.prefs.v1 (D57); Login reads presentation mode (D88)', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ railCollapsed: true, coreLinkSource: 'SIMULATED' }));
    await mount({ section: 'preferences' });
    expect(screen.getByTestId('screen-settings-section')).toBeTruthy();

    fireEvent(screen.getByTestId('settings-presentation-mode'), 'onSelectedChange', true);
    await flushAsync();
    expect(await storedPrefs()).toMatchObject({ presentationMode: true, railCollapsed: true, coreLinkSource: 'SIMULATED' });
    expect(await readPresentationMode()).toBe(true);

    fireEvent(screen.getByTestId('settings-reduce-motion'), 'onSelectedChange', true);
    fireEvent(screen.getByTestId('settings-haptics'), 'onSelectedChange', false);
    fireEvent.press(screen.getByTestId('settings-core-link-HEARTBEAT'));
    fireEvent.press(screen.getByTestId('settings-meter-size-compact'));
    await flushAsync();
    expect(motionStore.getState().reduceMotionOverride).toBe(true);
    expect(motionStore.getState().hapticsEnabled).toBe(false);
    expect(await storedPrefs()).toEqual({
      railCollapsed: true,
      coreLinkSource: 'HEARTBEAT',
      presentationMode: true,
      reduceMotion: true,
      haptics: false,
      meterSize: 'compact',
    });

    // Bahasa Indonesia is shown but disabled ("later", A10): nothing is written.
    fireEvent.press(screen.getByTestId('settings-language-id'));
    await flushAsync();
    expect(await storedPrefs()).not.toHaveProperty('language');
    expect(getMissingKeys()).toEqual([]);
  });

  it('Notifications: a switch per category, merged as one object; Critical stays on and disabled', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ haptics: true }));
    await mount({ section: 'notifications' });
    fireEvent(screen.getByTestId('settings-notify-storage'), 'onSelectedChange', false);
    await flushAsync();
    expect(await storedPrefs()).toEqual({ haptics: true, notifications: { devices: true, storage: false, time: true, system: true } });
    const critical = screen.getByTestId('settings-notify-critical');
    expect(critical.props.accessibilityState).toMatchObject({ disabled: true, checked: true });
    expect(getMissingKeys()).toEqual([]);
  });

  it('System Maintenance: Demo controls inject MIC 2 clip and Storage full (MA-30), clear, Reset; hidden in presentation mode', async () => {
    const test = await mount({ section: 'maintenance' });
    fireEvent.press(screen.getByTestId('settings-demo-trigger'));
    await flushAsync();

    fireEvent.press(screen.getByTestId('settings-demo-fault-MIC_CLIP'));
    let state = test.sim.store.getState();
    expect(state.faults.active.some((f) => f.kind === 'MIC_CLIP' && f.target === 'AUDIO-02')).toBe(true);
    expect(state.mics.find((m) => m.id === 'AUDIO-02')?.clipLatched).toBe(true);

    fireEvent.press(screen.getByTestId('settings-demo-fault-STORAGE_FULL'));
    state = test.sim.store.getState();
    expect(state.faults.active.some((f) => f.kind === 'STORAGE_FULL')).toBe(true);
    expect(screen.getByTestId('settings-demo-fault-STORAGE_FULL').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('settings-demo-active-count')).toHaveTextContent('2 faults active');

    // A second press clears; MIC 2's CLIP latch is reset with it.
    fireEvent.press(screen.getByTestId('settings-demo-fault-MIC_CLIP'));
    state = test.sim.store.getState();
    expect(state.faults.active.some((f) => f.kind === 'MIC_CLIP')).toBe(false);
    expect(state.mics.find((m) => m.id === 'AUDIO-02')?.clipLatched).toBe(false);

    fireEvent.press(screen.getByTestId('settings-demo-reset'));
    state = test.sim.store.getState();
    expect(state.faults.active).toEqual([]);
    expect(state.meta.scenario).toBe('idle');
    expect(getMissingKeys()).toEqual([]);
    cleanup();

    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ presentationMode: true }));
    resetSettingsPrefsForTests();
    await mount({ section: 'maintenance' });
    expect(screen.queryByTestId('settings-demo')).toBeNull();
    expect(screen.getByTestId('settings-demo-hidden')).toBeTruthy();
  });

  it('System Maintenance: Run diagnostics starts the simulator run and the sheet follows the eight checks', async () => {
    const test = await mount({ section: 'maintenance' });
    fireEvent.press(screen.getByTestId('settings-run-diagnostics'));
    await flushAsync();
    expect(test.sim.store.getState().diagnostics?.checks).toHaveLength(8);
    expect(screen.getByTestId('settings-diagnostics-sheet')).toBeTruthy();
    expect(screen.getByTestId('settings-diagnostics-headline')).toHaveTextContent('0 of 8 checks');
    act(() => test.advance(60_000, 500));
    expect(test.sim.store.getState().diagnostics?.completedAt).not.toBeNull();
    expect(screen.getByTestId('settings-diagnostics-headline')).not.toHaveTextContent('of 8 checks');
    expect(getMissingKeys()).toEqual([]);
  });

  it('Security & Privacy: auto-lock shows the 15-minute policy; Lock console and Sign out go through the runtime auth', async () => {
    const test = await mount({ section: 'security' });
    expect(screen.getByTestId('settings-auto-lock-5').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('settings-auto-lock-30').props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('settings-biometric')).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-security-pairing'));
    fireEvent.press(screen.getByTestId('settings-security-audit'));
    expect(mockRouter.push.mock.calls.map((call) => call[0])).toEqual(['/pair', '/audit']);
    fireEvent.press(screen.getByTestId('settings-security-sign-out'));
    await flushAsync();
    expect(test.sim.store.getState().auth.status).not.toBe('SIGNED_IN');
    expect(getMissingKeys()).toEqual([]);
  });

  it('About DEMS: v2.4.1, DEMS-IR-01, DEMO labels, licences sheet, Stack diagnostics link', async () => {
    await mount({ section: 'about' });
    expect(screen.getByTestId('settings-about-version').props.accessibilityLabel).toBe('Software release, v2.4.1');
    expect(screen.getByTestId('settings-about-device').props.accessibilityLabel).toBe('Device ID, DEMS-IR-01');
    expect(screen.getAllByTestId('settings-about-demo').length).toBe(2);
    fireEvent.press(screen.getByTestId('settings-about-licences-open'));
    await flushAsync();
    expect(screen.getByTestId('settings-licences-sheet')).toBeTruthy();
    expect(screen.getByText(/SIL Open Font License 1\.1/)).toBeTruthy();
    expect(screen.getByText(/Leandro Alamino/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-about-stack-check'));
    expect(mockRouter.push).toHaveBeenCalledWith('/stack-check');
    expect(getMissingKeys()).toEqual([]);
  });

  it('Account row opens the Profile sheet: role, demo permissions, Lock console', async () => {
    const test = await mount();
    fireEvent.press(screen.getByTestId('settings-account-row'));
    await flushAsync();
    expect(screen.getByTestId('settings-profile-sheet')).toBeTruthy();
    expect(screen.getByTestId('settings-profile-role')).toHaveTextContent('Role: Investigator');
    expect(screen.getByTestId('settings-profile-permission-SESSION_START')).toBeTruthy();
    expect(screen.queryByTestId('settings-profile-permission-EVIDENCE_EXPORT')).toBeNull();
    fireEvent.press(screen.getByTestId('settings-profile-lock'));
    await flushAsync();
    expect(test.sim.store.getState().auth.status).not.toBe('SIGNED_IN');
    expect(getMissingKeys()).toEqual([]);
  });
});
