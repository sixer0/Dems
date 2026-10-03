// Home (Dashboard) render test (step 77; 04_mobile_specs §4.3, §2.4, §7.3; MA-11 order, MA-12 panes,
// MA-18 unit part, MA-21, MA-30 Home tile). The screen renders inside the real AppProviders with an
// injected, hydrated test simulator (step 73's `renderWithRuntime`); expo-router's hooks are mocked
// (the route tree itself is covered by step 70's T-M02 harness), Skia is step 71's module mock.
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { getMissingKeys, i18n, resetMissingKeys } from '@/i18n';
import { motionStore, resetLoopRegistryForTests, resetMotionStateForTests, activeLoopNames } from '@/motion';
import { resetCoreLinkPrefsForTests } from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';
import { DashboardScreen } from './dashboard-screen';
import { HOME_LOOPS } from './home-motion';

jest.mock('@shopify/react-native-skia', () =>
  jest
    .requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock')
    .createSkiaMock(),
);

const mockPush = jest.fn();
const mockFocus = { focused: true };
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
  useIsFocused: () => mockFocus.focused,
}));

const WINDOWS = {
  phonePortrait: { width: 411, height: 923 },
  phoneLandscape: { width: 923, height: 411 },
  tabletPortrait: { width: 800, height: 1280 },
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

const label = (testID: string) => screen.getByTestId(testID).props.accessibilityLabel as string;
const textOf = (testID: string) => {
  const node = screen.getByTestId(testID);
  const parts: string[] = [];
  const walk = (n: ReactTestInstance | string) => {
    if (typeof n === 'string') parts.push(n);
    else n.children.forEach(walk);
  };
  walk(node);
  return parts.join('');
};

/**
 * The kit's Popover and Menu open only after measuring their trigger; React Native's Jest mocks
 * `measure` as a no-op, so give the trigger's native instance a layout (test-only).
 */
function stubMeasure(testID: string) {
  let node: ReactTestInstance | null = screen.getByTestId(testID);
  let stubbed = 0;
  while (node) {
    const instance = node.instance as { measure?: jest.Mock } | null;
    if (instance && typeof instance.measure === 'function' && 'mockImplementation' in instance.measure) {
      instance.measure.mockImplementation((...args: unknown[]) => {
        const callback = args[0] as (x: number, y: number, w: number, h: number, px: number, py: number) => void;
        callback(0, 0, 48, 48, 300, 40);
      });
      stubbed += 1;
    }
    node = node.parent;
  }
  expect(stubbed).toBeGreaterThan(0);
}

/**
 * Popover and Menu content become interactive once laid out below the top of the screen (the kit's
 * `isReady`); Jest never emits layout events, so emit one on every ancestor that listens.
 */
function layoutAncestors(testID: string) {
  let node: ReactTestInstance | null = screen.getByTestId(testID);
  while (node) {
    if (typeof node.props?.onLayout === 'function') {
      fireEvent(node, 'layout', { nativeEvent: { layout: { x: 16, y: 96, width: 280, height: 200 } } });
    }
    node = node.parent;
  }
}

async function mount(options: { scenario?: 'recording'; signIn?: boolean; window?: keyof typeof WINDOWS } = {}): Promise<TestSim> {
  setWindow(options.window ?? 'phonePortrait');
  const test = createTestSim(options.scenario ? { scenario: options.scenario } : {});
  if (options.signIn !== false) {
    const result = test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD);
    expect(result.ok).toBe(true);
  }
  renderWithRuntime(<DashboardScreen />, { sim: test.sim });
  await flushAsync();
  return test;
}

describe('Home (Dashboard) screen', () => {
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
    mockFocus.focused = true;
  });

  afterEach(() => {
    cleanup();
  });

  it('phone portrait: MB 2 regions H1–H5 in order, READY copy, 2/2, 2/2, 20% used, three recent rows', async () => {
    await mount();
    expect(screen.getByTestId('screen-home')).toBeTruthy();
    expect(orderOf(['home-header', 'home-status', 'home-tiles', 'home-actions', 'home-recent'])).toEqual([
      'home-header',
      'home-status',
      'home-tiles',
      'home-actions',
      'home-recent',
    ]);
    // H1: brand, bell, avatar "BS" (04 §9 #29).
    expect(screen.getByTestId('home-brand')).toBeTruthy();
    expect(screen.getByTestId('home-bell')).toBeTruthy();
    expect(textOf('home-avatar')).toBe('BS');
    // H2: READY.
    expect(textOf('home-status-title')).toBe('Ready for Recording');
    expect(textOf('home-status-subtitle')).toBe('All systems operational');
    expect(label('home-status-ring')).toBe('System status: READY');
    // H3: the dataset values (04 §9 #7, D28/Q1).
    expect(label('home-tile-camera-value')).toBe('2/2');
    expect(label('home-tile-microphone-value')).toBe('2/2');
    expect(label('home-tile-storage-value')).toBe('20%');
    expect(textOf('home-tile-camera-state')).toBe('Online');
    expect(textOf('home-tile-storage-state')).toBe('Healthy');
    // H4.
    expect(label('home-action-primary')).toBe('Start Session');
    expect(label('home-action-evidence')).toBe('View Evidence');
    // H5: newest first, evidence ids, "Today HH:mm" (UTC+07:00), subject chips from i18n (MA-21).
    const ids = [0, 1, 2].map((i) => textOf(`home-recent-row-${i}-id`));
    expect(ids).toEqual(['EV-20261001-0013', 'EV-20261001-0012', 'EV-20261001-0011']);
    expect(textOf('home-recent-row-0-when')).toBe('Today 09:35');
    expect(label('home-recent-row-0-subject')).toBe(i18n.t('common.subjectType.TERSANGKA'));
    expect(label('home-recent-row-1-subject')).toBe(i18n.t('common.subjectType.SAKSI'));
    expect(screen.queryByTestId('home-recent-row-3')).toBeNull();
    // Phone: no tablet-only parts.
    expect(screen.queryByTestId('home-devices')).toBeNull();
    expect(screen.queryByTestId('home-sealed-today')).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });

  it('navigates: Start → /session/new?step=1, View Evidence, See All, a tile, a recent row', async () => {
    await mount();
    fireEvent.press(screen.getByTestId('home-action-primary'));
    fireEvent.press(screen.getByTestId('home-action-evidence'));
    fireEvent.press(screen.getByTestId('home-recent-see-all'));
    fireEvent.press(screen.getByTestId('home-tile-storage'));
    fireEvent.press(screen.getByTestId('home-tile-camera'));
    fireEvent.press(screen.getByTestId('home-recent-row-0'));
    expect(mockPush.mock.calls.map((call) => call[0])).toEqual([
      '/session/new?step=1',
      '/evidence',
      '/sessions',
      '/storage',
      '/devices',
      '/sessions/SES-20261001-0023',
    ]);
  });

  it('recording: the status card shows REC and the timer and opens the monitor; Start becomes "Return to live session"', async () => {
    const test = await mount({ scenario: 'recording' });
    expect(textOf('home-status-title')).toBe('Session in progress');
    expect(screen.getByTestId('home-status-rec')).toBeTruthy();
    const before = label('home-status-timer');
    act(() => test.advance(3_000));
    expect(label('home-status-timer')).not.toBe(before);
    expect(label('home-action-primary')).toBe('Return to live session');
    fireEvent.press(screen.getByTestId('home-action-primary'));
    fireEvent.press(screen.getByTestId('home-status-open-live'));
    expect(mockPush.mock.calls.map((call) => call[0])).toEqual(['/session/live', '/session/live']);
    expect(getMissingKeys()).toEqual([]);
  });

  it('storage full (MA-30 Home part): the storage tile turns red and the status goes CRITICAL with the reason', async () => {
    const test = await mount();
    act(() => {
      test.sim.actions.inject('STORAGE_FULL');
      test.advance(200);
    });
    expect(textOf('home-tile-storage-state')).toBe('Full');
    expect(label('home-tile-storage-value')).toBe('99%');
    expect(textOf('home-status-title')).toBe('Recording Blocked');
    expect(textOf('home-flag-STORAGE_FULL')).toContain('Evidence storage full');
    expect(label('home-status-ring')).toBe('System status: CRITICAL');
    expect(getMissingKeys()).toEqual([]);
  });

  it('MIC 2 clip: the microphone tile warns and ATTENTION lists the device by name', async () => {
    const test = await mount();
    act(() => {
      test.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' });
      test.advance(500);
    });
    expect(textOf('home-tile-microphone-state')).toBe('Clipping');
    expect(textOf('home-status-title')).toBe('Attention Needed');
    expect(textOf('home-flag-MIC_AUDIO-02_CLIP')).toContain('MIC 2: clipping');
    expect(getMissingKeys()).toEqual([]);
  });

  it('bell: counts unacknowledged alerts, lists them in the popover and acknowledges one', async () => {
    const test = await mount();
    expect(screen.queryByTestId('home-bell-count')).toBeNull();
    act(() => {
      test.sim.actions.inject('FAN_STALL');
      test.advance(200);
    });
    expect(textOf('home-bell-count')).toBe('1');
    expect(label('home-bell')).toBe('Notifications, 1 new alert');
    stubMeasure('home-bell');
    fireEvent.press(screen.getByTestId('home-bell'));
    const alert = test.sim.store.getState().alerts.find((a) => a.active)!;
    expect(textOf(`home-alert-${alert.id}`)).toContain(i18n.t('common.faultKind.FAN_STALL'));
    layoutAncestors(`home-alert-${alert.id}`);
    fireEvent.press(screen.getByText(i18n.t('common.actions.acknowledge')));
    expect(test.sim.store.getState().alerts.find((a) => a.id === alert.id)?.acknowledged).toBe(true);
    expect(screen.queryByTestId('home-bell-count')).toBeNull();
    fireEvent.press(screen.getByTestId('home-alerts-view-all'));
    expect(mockPush).toHaveBeenLastCalledWith('/audit');
  });

  it('avatar menu: Profile opens Settings; Lock console signs out without touching a recording (§3.3)', async () => {
    const test = await mount({ scenario: 'recording' });
    stubMeasure('home-avatar');
    fireEvent.press(screen.getByTestId('home-avatar'));
    expect(screen.getByText('AKP Budi Santoso')).toBeTruthy();
    layoutAncestors('home-menu-profile');
    fireEvent.press(screen.getByTestId('home-menu-profile'));
    expect(mockPush).toHaveBeenLastCalledWith('/settings');
    stubMeasure('home-avatar');
    fireEvent.press(screen.getByTestId('home-avatar'));
    layoutAncestors('home-menu-lock');
    fireEvent.press(screen.getByTestId('home-menu-lock'));
    await flushAsync();
    expect(test.sim.store.getState().auth.status).toBe('SIGNED_OUT');
    expect(test.sim.store.getState().session?.state).toBe('RECORDING');
    expect(screen.queryByTestId('home-avatar')).toBeNull();
  });

  it('tablet landscape (expanded): 3 zones with the hero ring, chip row, 2x2 device tiles and sealed-today 7', async () => {
    await mount({ window: 'tabletLandscape' });
    expect(orderOf(['pane-status', 'pane-devices', 'pane-activity'])).toEqual(['pane-status', 'pane-devices', 'pane-activity']);
    const panes = within(screen.getByTestId('home-panes'));
    expect(panes.getByTestId('home-status-ring-state')).toBeTruthy();
    expect(textOf('home-status-ring-state')).toBe('READY');
    expect(screen.getByTestId('home-chips')).toBeTruthy();
    expect(label('home-chip-storage')).toBe('Storage: 20% used');
    for (const track of ['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02']) {
      expect(screen.getByTestId(`home-device-${track}`)).toBeTruthy();
    }
    expect(screen.getByTestId('home-device-VIDEO-01-feed')).toBeTruthy();
    expect(screen.getByTestId('home-device-AUDIO-02-meter')).toBeTruthy();
    expect(label('home-sealed-today-count')).toBe('7');
    // Header: title, state chip, Core link chip (Simulated default, Q-M8) and the clock.
    expect(screen.getByTestId('home-header-state')).toBeTruthy();
    expect(label('home-core-link')).toContain('Simulated');
    expect(screen.getByTestId('home-clock')).toBeTruthy();
    // No H3 tiles on expanded: the device tiles replace them.
    expect(screen.queryByTestId('home-tiles')).toBeNull();
    fireEvent.press(screen.getByTestId('home-device-VIDEO-02'));
    expect(mockPush).toHaveBeenLastCalledWith('/devices/CAM-02');
    expect(getMissingKeys()).toEqual([]);
  });

  it('tablet portrait (medium): 2 columns (hero + status + tiles | actions + recent)', async () => {
    await mount({ window: 'tabletPortrait' });
    expect(orderOf(['pane-status', 'pane-activity'])).toEqual(['pane-status', 'pane-activity']);
    expect(screen.queryByTestId('pane-devices')).toBeNull();
    expect(within(screen.getByTestId('pane-status')).getByTestId('home-tiles')).toBeTruthy();
    expect(within(screen.getByTestId('pane-activity')).getByTestId('home-recent')).toBeTruthy();
    expect(screen.getByTestId('home-status-ring-state')).toBeTruthy();
    expect(screen.queryByTestId('home-clock')).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });

  it('phone landscape: 2 columns (status, tiles, actions | recent)', async () => {
    await mount({ window: 'phoneLandscape' });
    const status = within(screen.getByTestId('pane-status'));
    expect(status.getByTestId('home-tiles')).toBeTruthy();
    expect(status.getByTestId('home-actions')).toBeTruthy();
    expect(within(screen.getByTestId('pane-activity')).getByTestId('home-recent')).toBeTruthy();
  });

  it('ambient loops: ring breath and Start sheen under full motion (no rotation in mini mode); none under reduced motion (MA-18 unit part)', async () => {
    await mount();
    expect(activeLoopNames()).toEqual(expect.arrayContaining([HOME_LOOPS.ringBreath, HOME_LOOPS.startSheen]));
    expect(activeLoopNames()).not.toContain(HOME_LOOPS.ringRotate);
    act(() => motionStore.getState().setReduceMotionOverride(true));
    expect(activeLoopNames()).toEqual([]);
    expect(screen.getByTestId('home-status-ring')).toBeTruthy();
  });

  it('pauses every Home loop while the screen is not focused (04 §7.8)', async () => {
    mockFocus.focused = false;
    await mount();
    expect(activeLoopNames()).toEqual([]);
  });

  it('tablet landscape registers the hero ring rotation and keeps the loop count within the P3 cap', async () => {
    await mount({ window: 'tabletLandscape' });
    const loops = activeLoopNames();
    expect(loops).toEqual(expect.arrayContaining([HOME_LOOPS.ringRotate, HOME_LOOPS.ringBreath, HOME_LOOPS.startSheen]));
    expect(loops.length).toBeLessThanOrEqual(4);
  });

  it('new seal while Home is open: one success toast naming the evidence item', async () => {
    const test = await mount({ scenario: 'recording' });
    act(() => {
      test.sim.actions.stopRecording('Interview completed');
    });
    act(() => test.advance(15_000));
    // The kit renders each toast label in two Text nodes (measured with a single toast.show), so
    // exactly one toast is two nodes, both naming the new item (EV 0014, D67).
    const found = screen.getAllByText(/Evidence EV-\d{8}-\d{4} sealed/);
    expect(found).toHaveLength(2);
    expect(new Set(found.map((node) => String(node.props.children)))).toEqual(new Set(['Evidence EV-20261001-0014 sealed']));
  });
});
