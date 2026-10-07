// E-fix row FX-M2b, defects E2E-P-1 and E2E-T-2 (decision D199/D200/D201), simulated in jest.
//
// On the devices, a tab switch from a nested screen lost the UI-thread animated updates of that commit
// on views (opacity, transform) while a text colour still followed: the phone's bar showed the new tab's
// label gold over a grey icon, the old tab's icon gold and the pill on the old tab (90a); the tablet's
// rail showed the same, and the Devices screen stayed mounted at opacity 0 for minutes (12_devices_blank).
// Jest runs no native UI thread, so this file models the WORST case of that loss: every
// `useAnimatedStyle` keeps the style of its first render forever (no UI-thread update ever lands).
// Under that model the chrome must still end in the right state once the motion budgets are over:
// - the visible icon and label of the active tab are gold, every other tab's are grey;
// - the visible indicator (pill or rail card) sits on the active tab's frame;
// - the newly focused screen is visible (effective opacity 1), never left invisible.
// The real route tree runs (W70's router harness: the real AppTabs, BottomTabBar, NavRail, screens).
// What only the devices can confirm is listed in gateway_check/11d_efix_mobile_screens.md (FX-M2b).
// `@jest/globals` first: the Reanimated mock below runs while the harness loads, and it needs `jest`.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
// The harness next: its first import prepares the module mocks the route tree needs (see its header).
import { FakeRuntime, renderApp, resetShellState, routeTestSim } from '../testing/router-harness';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { palette } from '@dems/shared/tokens';
import { colorFadeBudgetMs, indicatorTravelBudgetMs } from '@/components/composed/nav';
import { FULL_MOTION, REDUCED_MOTION, resetMotionStateForTests } from '@/motion';
import { tabFadeBudgetMs } from '../app-tabs';

jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));

// The model of the device defect: no UI-thread update of an animated style ever lands.
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<Record<string, unknown>>('react-native-reanimated');
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    ...actual,
    useAnimatedStyle: (updater: () => Record<string, unknown>) => {
      const first = React.useRef<Record<string, unknown> | null>(null);
      if (first.current === null) first.current = updater();
      return first.current;
    },
  };
});

const PHONE_ITEMS = ['home', 'sessions', 'evidence', 'devices', 'more'] as const;
const TABLET_ITEMS = ['home', 'sessions', 'evidence', 'devices', 'storage', 'network-time', 'audit', 'settings'] as const;
const BAR_ITEM_WIDTH = 82;
const RAIL_ITEM_HEIGHT = 64;
const PILL_WIDTH = 56;

function signedIn(): FakeRuntime {
  const runtime = new FakeRuntime();
  runtime.signInAs();
  return runtime;
}

const flat = (node: ReactTestInstance): ViewStyle & TextStyle => (StyleSheet.flatten(node.props?.style) ?? {}) as ViewStyle & TextStyle;

/** The product of the opacities from the node up to the root; 0 under a `display: 'none'` (an unfocused tab). */
function effectiveOpacity(node: ReactTestInstance): number {
  let opacity = 1;
  let current: ReactTestInstance | null = node;
  while (current) {
    const style = flat(current);
    if (style.display === 'none') return 0;
    if (typeof style.opacity === 'number') opacity *= style.opacity;
    current = current.parent;
  }
  return opacity;
}

/** The colours of the icons and labels a person sees in one tab item (effective opacity > 0). */
function visibleTints(name: string): { icons: string[]; labels: string[] } {
  const item = screen.getByTestId(`nav-item-${name}`);
  const icons = item
    .findAll((node) => typeof node.type !== 'string' && node.props?.size === 24 && typeof node.props?.color === 'string')
    .filter((node) => effectiveOpacity(node) > 0)
    .map((node) => String(node.props.color));
  // Raw host Text nodes: the fading copy is hidden from TalkBack but not from the eye.
  const labels = item
    .findAll((node) => (node.type as unknown) === 'Text' && typeof node.props?.children === 'string')
    .filter((node) => effectiveOpacity(node) > 0)
    .map((node) => String(flat(node).color ?? ''));
  return { icons: [...new Set(icons)], labels: [...new Set(labels)] };
}

/** The translate of the visible indicator views (settled or travelling) with the given testID prefix. */
function visibleIndicators(prefix: 'nav-bottom-indicator' | 'nav-rail-indicator'): { x: number; y: number }[] {
  return screen
    .UNSAFE_root.findAll((node) => typeof node.type === 'string' && typeof node.props?.testID === 'string' && node.props.testID.startsWith(prefix))
    .filter((node) => effectiveOpacity(node) > 0)
    .map((node) => {
      const transform = (flat(node).transform ?? []) as unknown as readonly Record<string, number>[];
      const x = transform.find((entry) => 'translateX' in entry)?.translateX ?? 0;
      const y = transform.find((entry) => 'translateY' in entry)?.translateY ?? 0;
      return { x, y };
    });
}

function layoutBar(): void {
  PHONE_ITEMS.forEach((name, index) => {
    fireEvent(screen.getByTestId(`nav-item-${name}`), 'layout', { nativeEvent: { layout: { x: index * BAR_ITEM_WIDTH, y: 0, width: BAR_ITEM_WIDTH, height: 60 } } });
  });
}

function layoutRail(): void {
  TABLET_ITEMS.forEach((name, index) => {
    fireEvent(screen.getByTestId(`nav-item-${name}`), 'layout', { nativeEvent: { layout: { x: 0, y: index * (RAIL_ITEM_HEIGHT + 4), width: 216, height: RAIL_ITEM_HEIGHT } } });
  });
}

/** The veil and the fading copies are hidden from TalkBack on purpose; the queries must still see them. */
const HIDDEN_TOO = { includeHiddenElements: true } as const;
/** Every motion budget is over (fade copy, indicator trip, veil), with a margin. */
const MOTION_OVER_MS = Math.max(colorFadeBudgetMs(FULL_MOTION), indicatorTravelBudgetMs(FULL_MOTION), tabFadeBudgetMs(FULL_MOTION)) + 100;

/** Veils a person would see (effective opacity > 0): a screen under one is covered, not visible. */
function visibleVeils(): number {
  return screen.queryAllByTestId('tab-fade-veil', HIDDEN_TOO).filter((node) => effectiveOpacity(node) > 0).length;
}

async function wait(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

beforeEach(async () => {
  resetShellState();
  resetMotionStateForTests();
  await AsyncStorage.clear();
});

afterEach(() => {
  resetMotionStateForTests();
});

describe('E2E-P-1 (phone bar), every UI-thread update lost: the highlight still ends on the active tab', () => {
  it('Sessions -> a session detail -> Evidence: Evidence gold (icon and label), Sessions grey, the pill on Evidence, the Evidence screen visible', async () => {
    const app = renderApp('/sessions', { runtime: signedIn(), sim: routeTestSim() });
    layoutBar();
    act(() => router.push('/sessions/SES-20261001-0017'));
    expect(app.getPathname()).toBe('/sessions/SES-20261001-0017');
    fireEvent.press(screen.getByTestId('nav-item-evidence'));
    expect(app.getPathname()).toBe('/evidence');
    // The screen the person switched to is drawn at full opacity at once (a veil may lie over it).
    expect(effectiveOpacity(screen.getByTestId('screen-evidence'))).toBe(1);

    await wait(MOTION_OVER_MS);

    expect(visibleTints('evidence')).toEqual({ icons: [palette.gold], labels: [palette.gold] });
    expect(visibleTints('sessions')).toEqual({ icons: [palette.gray], labels: [palette.gray] });
    for (const name of ['home', 'devices', 'more']) expect(visibleTints(name)).toEqual({ icons: [palette.gray], labels: [palette.gray] });
    // The one visible pill is centred on Evidence (item 2).
    expect(visibleIndicators('nav-bottom-indicator')).toEqual([{ x: 2 * BAR_ITEM_WIDTH + (BAR_ITEM_WIDTH - PILL_WIDTH) / 2, y: 4 }]);
    expect(effectiveOpacity(screen.getByTestId('screen-evidence'))).toBe(1);
    expect(visibleVeils()).toBe(0);

    // And later switches keep it right (on the phone, the Sessions icon stayed gold on Devices and More).
    fireEvent.press(screen.getByTestId('nav-item-devices'));
    await wait(MOTION_OVER_MS);
    expect(visibleTints('devices')).toEqual({ icons: [palette.gold], labels: [palette.gold] });
    for (const name of ['home', 'sessions', 'evidence', 'more']) expect(visibleTints(name)).toEqual({ icons: [palette.gray], labels: [palette.gray] });
    expect(visibleIndicators('nav-bottom-indicator')).toEqual([{ x: 3 * BAR_ITEM_WIDTH + (BAR_ITEM_WIDTH - PILL_WIDTH) / 2, y: 4 }]);
    expect(effectiveOpacity(screen.getByTestId('screen-devices'))).toBe(1);
    expect(visibleVeils()).toBe(0);
  });

  it('full motion keeps M-MB-01 and M-APP-04: the fading copy, the travelling pill and the veil exist during the motion, and React removes them after their budgets', async () => {
    renderApp('/sessions', { runtime: signedIn(), sim: routeTestSim() });
    layoutBar();
    fireEvent.press(screen.getByTestId('nav-item-evidence'));
    expect(screen.getByTestId('nav-bottom-indicator-travel', HIDDEN_TOO)).toBeTruthy();
    expect(screen.getByTestId('nav-item-sessions-fading-icon', HIDDEN_TOO)).toBeTruthy();
    expect(screen.getByTestId('nav-item-evidence-fading-icon', HIDDEN_TOO)).toBeTruthy();
    expect(screen.queryAllByTestId('tab-fade-veil', HIDDEN_TOO).length).toBeGreaterThan(0);
    // While the copy travels, the settled pill is hidden (not moved): exactly one pill is visible.
    expect(visibleIndicators('nav-bottom-indicator')).toHaveLength(1);

    await wait(MOTION_OVER_MS);

    expect(screen.queryByTestId('nav-bottom-indicator-travel', HIDDEN_TOO)).toBeNull();
    expect(screen.queryByTestId('nav-item-sessions-fading-icon', HIDDEN_TOO)).toBeNull();
    expect(screen.queryByTestId('nav-item-evidence-fading-icon', HIDDEN_TOO)).toBeNull();
    expect(screen.queryAllByTestId('tab-fade-veil', HIDDEN_TOO)).toHaveLength(0);
  });

  it('reduced motion (the testers\' motion=off): right at once, no overlay is ever drawn', () => {
    resetMotionStateForTests({ linkMotion: 'off' });
    renderApp('/sessions', { runtime: signedIn(), sim: routeTestSim() });
    layoutBar();
    act(() => router.push('/sessions/SES-20261001-0017'));
    fireEvent.press(screen.getByTestId('nav-item-evidence'));
    expect(screen.queryByTestId('nav-bottom-indicator-travel', HIDDEN_TOO)).toBeNull();
    expect(screen.queryByTestId('nav-item-sessions-fading-icon', HIDDEN_TOO)).toBeNull();
    expect(visibleTints('evidence')).toEqual({ icons: [palette.gold], labels: [palette.gold] });
    expect(visibleTints('sessions')).toEqual({ icons: [palette.gray], labels: [palette.gray] });
    expect(visibleIndicators('nav-bottom-indicator')).toEqual([{ x: 2 * BAR_ITEM_WIDTH + (BAR_ITEM_WIDTH - PILL_WIDTH) / 2, y: 4 }]);
    // The screen is drawn at full opacity; the reduced fade is only the short veil over it.
    expect(effectiveOpacity(screen.getByTestId('screen-evidence'))).toBe(1);
    expect(REDUCED_MOTION.policy).toBe('reduced');
  });
});

describe('E2E-T-2 (tablet rail), every UI-thread update lost: the Devices screen is never left invisible', () => {
  it('Evidence detail -> rail Devices: the Devices screen visible, Devices gold, Evidence grey, the card on Devices', async () => {
    const app = renderApp('/evidence/EV-20261001-0007', { runtime: signedIn(), window: 'tabletLandscape', sim: routeTestSim() });
    layoutRail();
    expect(app.getPathname()).toMatch(/^\/evidence/);
    fireEvent.press(screen.getByTestId('nav-item-devices'));
    expect(app.getPathname()).toBe('/devices');
    // At once (before any budget): the screen is drawn at full opacity under the veil; it is mounted and not hidden.
    expect(effectiveOpacity(screen.getByTestId('screen-devices'))).toBe(1);

    await wait(MOTION_OVER_MS);

    expect(effectiveOpacity(screen.getByTestId('screen-devices'))).toBe(1);
    expect(visibleVeils()).toBe(0);
    expect(visibleTints('devices')).toEqual({ icons: [palette.gold], labels: [palette.gold] });
    expect(visibleTints('evidence')).toEqual({ icons: [palette.gray], labels: [palette.gray] });
    expect(visibleIndicators('nav-rail-indicator')).toEqual([{ x: 0, y: 3 * (RAIL_ITEM_HEIGHT + 4) }]);
  });
});
