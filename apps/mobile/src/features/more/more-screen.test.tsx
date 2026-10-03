// More render test (step 89; 04_mobile_specs §4.17, §2.3, H-MB-01; blueprint row 89: "its render test
// lists every More destination and each navigates to its route"). The screen renders inside the real
// AppProviders with an injected, hydrated test simulator (step 73's `renderWithRuntime`); expo-router's
// `useRouter` is mocked (the route tree and the hidden-trigger tab jumps are step 70's T-M02 harness).
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreLinkPrefsForTests } from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';
import { linkDestinations, needsRecovery } from './more-model';
import { MoreScreen } from './more-screen';

jest.mock('@shopify/react-native-skia', () =>
  jest
    .requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock')
    .createSkiaMock(),
);

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
  useIsFocused: () => true,
}));

const WINDOWS = {
  phonePortrait: { width: 411, height: 923 },
  phoneLandscape: { width: 923, height: 411 },
  tabletLandscape: { width: 1280, height: 800 },
} as const;

function setWindow(name: keyof typeof WINDOWS) {
  const { width, height } = WINDOWS[name];
  act(() => {
    Dimensions.set({ window: { width, height, scale: 2, fontScale: 1 }, screen: { width, height, scale: 2, fontScale: 1 } });
  });
}

const textOf = (testID: string) => {
  const parts: string[] = [];
  const walk = (n: ReactTestInstance | string) => {
    if (typeof n === 'string') parts.push(n);
    else n.children.forEach(walk);
  };
  walk(screen.getByTestId(testID));
  return parts.join('');
};
const label = (testID: string) => screen.getByTestId(testID).props.accessibilityLabel as string;

/** Document order of the given testIDs in the rendered tree. */
function sectionsOrder(root: ReactTestInstance, ids: readonly string[]): string[] {
  const order: string[] = [];
  const walk = (node: ReactTestInstance) => {
    const id = node.props?.testID as string | undefined;
    if (id && ids.includes(id) && !order.includes(id)) order.push(id);
    for (const child of node.children) if (typeof child !== 'string') walk(child);
  };
  walk(root);
  return order;
}

async function mount(options: { scenario?: 'recording'; window?: keyof typeof WINDOWS } = {}): Promise<TestSim> {
  setWindow(options.window ?? 'phonePortrait');
  const test = createTestSim(options.scenario ? { scenario: options.scenario } : {});
  expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  renderWithRuntime(<MoreScreen />, { sim: test.sim });
  await flushAsync();
  return test;
}

const CONSOLE = ['storage', 'network-time', 'audit', 'settings'] as const;

describe('More screen', () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  beforeAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  beforeEach(async () => {
    await AsyncStorage.clear();
    resetCoreLinkPrefsForTests();
    resetMotionStateForTests();
    resetLoopRegistryForTests();
    resetMissingKeys();
    mockPush.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('phone portrait: header, operator card, the four console tiles, the links and the footer, in order', async () => {
    await mount();
    expect(screen.getByTestId('screen-more')).toBeTruthy();
    expect(sectionsOrder(screen.UNSAFE_root, ['more-header', 'more-operator', 'more-console', 'more-links', 'more-footer'])).toEqual([
      'more-header',
      'more-operator',
      'more-console',
      'more-links',
      'more-footer',
    ]);
    // Operator card (04 §4.17: Avatar, name, role).
    expect(textOf('more-operator-name')).toBe('AKP Budi Santoso');
    expect(textOf('more-operator-initials')).toBe('BS');
    expect(label('more-operator-role')).toBe('Investigator');
    expect(textOf('more-operator-id')).toBe('OPR-001');
    expect(textOf('more-operator-since')).toMatch(/^Signed in \d{2}:\d{2}$/);
    expect(screen.queryByTestId('more-operator-recording-note')).toBeNull();
    // Console tiles with their live line and chip (dataset: 20% used, GNSS, chain intact, paired).
    for (const name of CONSOLE) expect(screen.getByTestId(`more-dest-${name}`)).toBeTruthy();
    expect(label('more-dest-storage-value')).toBe('20%');
    expect(label('more-dest-storage-chip')).toBe('Healthy');
    expect(textOf('more-dest-network-time-detail')).toBe('Time GNSSLAN connected');
    expect(label('more-dest-network-time-chip')).toBe('Synchronized');
    expect(label('more-dest-audit-chip')).toBe('Chain OK');
    expect(textOf('more-dest-audit-detail')).toMatch(/^\d+ events$/);
    expect(label('more-dest-settings-chip')).toBe('5 sections');
    // Links: Pairing, About, Developer gallery (jest runs as a debug build); no Recovery while idle.
    expect(screen.getByTestId('more-link-pairing')).toBeTruthy();
    expect(label('more-link-pairing-chip')).toBe('Paired');
    expect(textOf('more-link-about-detail')).toBe('Version 2.4.1, build and licences');
    expect(screen.getByTestId('more-link-dev-gallery')).toBeTruthy();
    expect(screen.queryByTestId('more-link-recovery')).toBeNull();
    // Footer: version, DEMO label, Core link chip (Simulated by default, Q-M8).
    expect(textOf('more-version')).toBe('DEMS EDGE CLIENT · v2.4.1');
    expect(label('more-demo')).toBe('DEMO');
    expect(label('more-core-link')).toBe('Core link: Simulated (Simulated)');
    expect(screen.queryByTestId('more-in-rail')).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });

  it('every More destination navigates to its route (console jumps are tab routes, H-MB-01)', async () => {
    await mount();
    const ids = [...CONSOLE.map((name) => `more-dest-${name}`), 'more-link-pairing', 'more-link-about', 'more-link-dev-gallery'];
    for (const id of ids) fireEvent.press(screen.getByTestId(id));
    expect(mockPush.mock.calls.map((call) => call[0])).toEqual([
      '/storage',
      '/network-time',
      '/audit',
      '/settings',
      '/pair',
      '/settings/about',
      '/dev-gallery',
    ]);
  });

  it('a FAULT session adds the Recovery row (danger chip) that opens /session/recovery; the card says recording continues', async () => {
    const test = await mount({ scenario: 'recording' });
    expect(screen.queryByTestId('more-link-recovery')).toBeNull();
    expect(screen.getByTestId('more-operator-recording-note')).toBeTruthy();
    act(() => test.sim.actions.inject('POWER_FAIL'));
    expect(test.sim.store.getState().session?.state).toBe('FAULT');
    expect(label('more-link-recovery-chip')).toBe('Fault');
    fireEvent.press(screen.getByTestId('more-link-recovery'));
    expect(mockPush).toHaveBeenLastCalledWith('/session/recovery');
    expect(getMissingKeys()).toEqual([]);
  });

  it('live chips follow the simulator: Storage full and an audit-chain discontinuity', async () => {
    const test = await mount();
    act(() => test.sim.actions.inject('STORAGE_FULL'));
    expect(label('more-dest-storage-chip')).toBe('Full');
    act(() => test.sim.actions.inject('AUDIT_TAMPER'));
    expect(label('more-dest-audit-chip')).toBe('Discontinuity');
  });

  it('tablet landscape: the rail already lists the console destinations, so More does not repeat them', async () => {
    await mount({ window: 'tabletLandscape' });
    for (const name of CONSOLE) expect(screen.queryByTestId(`more-dest-${name}`)).toBeNull();
    expect(textOf('more-in-rail')).toBe('Storage, Network & Time, Audit and Settings are in the navigation rail.');
    fireEvent.press(screen.getByTestId('more-link-pairing'));
    fireEvent.press(screen.getByTestId('more-link-about'));
    expect(mockPush.mock.calls.map((call) => call[0])).toEqual(['/pair', '/settings/about']);
    expect(getMissingKeys()).toEqual([]);
  });

  it('phone landscape keeps the console (the 5-item rail has More) in one row of four', async () => {
    await mount({ window: 'phoneLandscape' });
    const row = within(screen.getByTestId('more-console-row-0'));
    for (const name of CONSOLE) expect(row.getByTestId(`more-dest-${name}`)).toBeTruthy();
    expect(screen.queryByTestId('more-console-row-1')).toBeNull();
    expect(screen.queryByTestId('more-in-rail')).toBeNull();
  });

  it('phone portrait lays the console out as two rows of two', async () => {
    await mount();
    expect(within(screen.getByTestId('more-console-row-0')).getByTestId('more-dest-network-time')).toBeTruthy();
    expect(within(screen.getByTestId('more-console-row-1')).getByTestId('more-dest-settings')).toBeTruthy();
  });

  it('Lock console signs the operator out without touching the recording (§6.4)', async () => {
    const test = await mount({ scenario: 'recording' });
    fireEvent.press(screen.getByTestId('more-lock'));
    expect(test.sim.store.getState().auth.status).toBe('SIGNED_OUT');
    expect(test.sim.store.getState().session?.state).toBe('RECORDING');
  });

  it('Sign out signs the operator out without touching the recording (§3.3)', async () => {
    const test = await mount({ scenario: 'recording' });
    fireEvent.press(screen.getByTestId('more-sign-out'));
    expect(test.sim.store.getState().auth.status).toBe('SIGNED_OUT');
    expect(test.sim.store.getState().session?.state).toBe('RECORDING');
  });
});

describe('More model', () => {
  it('lists Recovery only for FAULT and RECOVERY, and the gallery only in debug builds', () => {
    expect(linkDestinations({ sessionState: null, debug: false })).toEqual(['pairing', 'about']);
    expect(linkDestinations({ sessionState: 'RECORDING', debug: true })).toEqual(['pairing', 'about', 'dev-gallery']);
    expect(linkDestinations({ sessionState: 'FAULT', debug: false })).toEqual(['pairing', 'recovery', 'about']);
    expect(needsRecovery('RECOVERY')).toBe(true);
    expect(needsRecovery('SEALED')).toBe(false);
  });
});
