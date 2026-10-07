// Storage screen render test (step 85; 04_mobile_specs §4.13 MB 8, §2.4 Storage row, §7.3 Storage;
// D28/Q1 20% USED; AC-54 389h 45m). The screen renders inside the real AppProviders with an
// injected, hydrated test simulator (step 73's `renderWithRuntime`); expo-router's hooks are mocked,
// Skia is step 71's module mock and the gorhom sheet is the package's own mock (step 79 pattern).
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, screen } from '@testing-library/react-native';
// Named imports: the MA-20 scan (`Haptics\.` outside src/motion/haptics, haptics.test.ts) covers tests too.
import { NotificationFeedbackType, notificationAsync } from 'expo-haptics';
import { Dimensions } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreLinkPrefsForTests } from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';
import { StorageScreen } from './storage-screen';

jest.mock('@gorhom/bottom-sheet', () => ({
  __esModule: true,
  ...jest.requireActual<Record<string, unknown>>('@gorhom/bottom-sheet/mock'),
}));

jest.mock('@shopify/react-native-skia', () =>
  jest
    .requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock')
    .createSkiaMock(),
);

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, navigate: jest.fn(), canGoBack: () => true }),
  useIsFocused: () => true,
}));

jest.setTimeout(20_000);

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
  const parts: string[] = [];
  const walk = (n: ReactTestInstance | string) => {
    if (typeof n === 'string') parts.push(n);
    else n.children.forEach(walk);
  };
  walk(screen.getByTestId(testID));
  return parts.join('');
};
const rowLabels = () => screen.queryAllByTestId('storage-activity-row').map((row) => String(row.props.accessibilityLabel));

async function mount(options: { scenario?: 'recording'; operator?: string; window?: keyof typeof WINDOWS } = {}): Promise<TestSim> {
  setWindow(options.window ?? 'phonePortrait');
  const test = createTestSim(options.scenario ? { scenario: options.scenario } : {});
  const result = test.sim.actions.signIn(options.operator ?? 'budi.santoso', DEMO_OPERATOR_PASSWORD);
  expect(result.ok).toBe(true);
  renderWithRuntime(<StorageScreen />, { sim: test.sim });
  await flushAsync();
  return test;
}

async function openManage() {
  fireEvent.press(screen.getByTestId('storage-manage'));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe('Storage screen', () => {
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
    mockBack.mockClear();
    jest.mocked(notificationAsync).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('phone portrait: MB 8 regions in order, ring 20% USED, 3.2 TB Free of 4.0 TB, legend, KPIs, activity', async () => {
    await mount();
    expect(screen.getByTestId('screen-storage')).toBeTruthy();
    expect(orderOf(['storage-header', 'storage-capacity', 'storage-activity', 'storage-manage'])).toEqual([
      'storage-header',
      'storage-capacity',
      'storage-activity',
      'storage-manage',
    ]);
    expect(screen.getByTestId('storage-back')).toBeTruthy();
    // D28/Q1: the ring shows USED (MB 8's "80%" is the free share).
    expect(label('storage-ring')).toBe('Evidence storage 20% used, READY');
    expect(screen.getByTestId('storage-ring').props.accessibilityValue).toEqual({ min: 0, max: 100, now: 20 });
    expect(label('storage-ring-percent')).toBe('20%');
    expect(textOf('storage-ring-label')).toBe('USED');
    expect(textOf('storage-free-headline')).toBe('3.2 TB Free');
    expect(textOf('storage-free-total')).toBe('of 4.0 TB');
    expect(textOf('storage-legend-used-value')).toBe('804 GB');
    expect(textOf('storage-legend-free-value')).toBe('3.2 TB');
    expect(textOf('storage-legend-sealed-value')).toBe('7');
    expect(textOf('storage-legend-pending-value')).toBe('1');
    // Phone KPI strip (04 §9 #17; AC-54).
    expect(textOf('storage-kpi-writeSpeed-value')).toBe('0.0');
    expect(textOf('storage-kpi-writeSpeed-caption')).toBe('Idle');
    expect(textOf('storage-kpi-sessionSize-value')).toBe('—');
    expect(textOf('storage-kpi-estRemaining-value')).toBe('389h 45m');
    expect(textOf('storage-kpi-estRemaining-caption')).toBe('at 8.2 GB/h');
    // Recent Storage Activity: at most 5 rows, each with a WIB time.
    const rows = rowLabels();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(5);
    for (const row of rows) expect(row).toMatch(/^\d{2}:\d{2}:\d{2}, /);
    expect(getMissingKeys()).toEqual([]);
  });

  it('See All opens the audit filtered to storage; back returns', async () => {
    await mount();
    fireEvent.press(screen.getByTestId('storage-activity-see-all'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/audit', params: { category: 'storage' } });
    fireEvent.press(screen.getByTestId('storage-back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('LOW then FULL: inline Alert, 1 toast per escalation (its drawn count does not grow on later ticks), 1 haptic each, ring 99%, fault rows', async () => {
    const test = await mount();
    expect(screen.queryByTestId('storage-alert-LOW')).toBeNull();
    const haptics = () => jest.mocked(notificationAsync).mock.calls.length;
    const hapticsBefore = haptics();
    act(() => {
      test.sim.actions.inject('STORAGE_LOW');
      test.advance(200);
    });
    expect(screen.getByTestId('storage-alert-LOW')).toBeTruthy();
    // W93-17/R16 (FXR-M): "one toast" with a count. The kit draws a toast's text more than once, so the
    // count is what ONE toast draws, and later ticks of the same escalation must not add another.
    const drawnByOneLowToast = screen.getAllByText('Evidence storage is low').length;
    expect(drawnByOneLowToast).toBeGreaterThan(0);
    act(() => test.advance(2_000));
    expect(screen.getAllByText('Evidence storage is low')).toHaveLength(drawnByOneLowToast);
    expect(haptics() - hapticsBefore).toBe(1);
    expect(jest.mocked(notificationAsync)).toHaveBeenCalledWith(NotificationFeedbackType.Warning);
    expect(label('storage-ring')).toBe('Evidence storage 86% used, LOW');

    // The haptics service allows one haptic per 400 ms of wall time (04 §7.6).
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 450));
    });
    act(() => {
      test.sim.actions.inject('STORAGE_FULL');
      test.advance(600);
    });
    expect(screen.getByTestId('storage-alert-FULL')).toBeTruthy();
    expect(screen.queryByTestId('storage-alert-LOW')).toBeNull();
    expect(textOf('storage-alert-FULL')).toContain('Storage full. Recording is blocked.');
    const drawnByOneFullToast = screen.getAllByText('Evidence storage is full').length;
    expect(drawnByOneFullToast).toBeGreaterThan(0);
    act(() => test.advance(2_000));
    expect(screen.getAllByText('Evidence storage is full')).toHaveLength(drawnByOneFullToast);
    expect(jest.mocked(notificationAsync)).toHaveBeenCalledWith(NotificationFeedbackType.Error);
    expect(haptics() - hapticsBefore).toBe(2);
    expect(label('storage-ring')).toBe('Evidence storage 99% used, FULL');
    expect(label('storage-ring-percent')).toBe('99%');
    expect(rowLabels()[0]).toContain('Fault raised · Storage full');
    expect(getMissingKeys()).toEqual([]);
  });

  it('Manage Storage as an Investigator: the policy is read-only with the reason (SIM-GAP-M85-2)', async () => {
    await mount();
    await openManage();
    expect(screen.getByTestId('storage-manage-sheet')).toBeTruthy();
    expect(textOf('storage-manage-readonly')).toContain('Your role (Investigator) can view the storage policy');
    expect(textOf('storage-manage-current')).toBe('Current: 90 days · auto-archive on');
    expect(textOf('storage-manage-thresholds')).toContain('LOW at 85%');
    expect(textOf('storage-manage-thresholds')).toContain('FULL at 98%');
    expect(screen.getByTestId('storage-manage-apply').props.accessibilityState?.disabled).toBe(true);
    expect(getMissingKeys()).toEqual([]);
  });

  it('Manage Storage as a Supervisor: Apply writes the policy, toasts and adds the activity row', async () => {
    const test = await mount({ operator: 'andi.pratama' });
    await openManage();
    expect(screen.queryByTestId('storage-manage-readonly')).toBeNull();
    fireEvent.press(screen.getByTestId('storage-manage-retention-YEAR_1'));
    fireEvent(screen.getByTestId('storage-manage-auto-archive'), 'onSelectedChange', false);
    fireEvent.press(screen.getByTestId('storage-manage-apply'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });
    expect(test.sim.store.getState().storagePolicy).toEqual({ retentionPolicy: 'YEAR_1', retentionDays: 365, autoArchive: false });
    expect(screen.getAllByText('Storage policy updated (simulated)').length).toBeGreaterThan(0);
    expect(rowLabels()[0]).toContain('Storage policy changed · 365 days · auto-archive off');
    expect(screen.queryByTestId('storage-manage-sheet')).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });

  it('recording: write speed 2.3 MB/s at 8.2 GB/h and a live session size', async () => {
    const test = await mount({ scenario: 'recording' });
    act(() => test.advance(1_100)); // the health step writes the rate once per second
    expect(textOf('storage-kpi-writeSpeed-value')).toBe('2.3');
    // The phone strip shortens the caption; the accessible label keeps the rate.
    expect(textOf('storage-kpi-writeSpeed-caption')).toBe('Recording');
    expect(label('storage-kpi-writeSpeed')).toBe('Write Speed: 2.3 MB/s, Recording · 8.2 GB/h');
    expect(textOf('storage-kpi-sessionSize-value')).toMatch(/^\d+\.\d{2}$/);
    expect(textOf('storage-kpi-sessionSize-caption')).toBe('Live');
  });

  it('tablet landscape: capacity and activity side by side, four KPI tiles, no back arrow', async () => {
    await mount({ window: 'tabletLandscape' });
    expect(screen.getByTestId('pane-capacity')).toBeTruthy();
    expect(screen.getByTestId('pane-activity')).toBeTruthy();
    expect(screen.queryByTestId('storage-back')).toBeNull();
    expect(screen.getByTestId('storage-kpi-retention')).toBeTruthy();
    expect(textOf('storage-kpi-retention-value')).toBe('90 days');
    expect(label('storage-ring')).toBe('Evidence storage 20% used, READY');
    expect(getMissingKeys()).toEqual([]);
  });
});
