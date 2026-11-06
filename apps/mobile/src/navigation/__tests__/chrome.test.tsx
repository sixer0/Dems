// The responsive navigation chrome (04_mobile_specs §2.2-§2.5, §3.4, §3.8; C-5; step 70):
// bottom bar on phones, rail on landscape phones and tablets, the extended rail with its
// persisted collapse, hidden More destinations (H-MB-01), history back, the live mini-bar,
// master-detail hand-over, and rotation without remounting the open screen (MA-13 chrome part).
// The harness must be the first import (see its header).
import { FakeRuntime, TEST_INSETS, renderApp, resetShellState, setWindow } from '../testing/router-harness';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
// Named import: the MA-20 grep (`Haptics\.` outside motion/haptics) must stay clean in tests too.
import { selectionAsync } from 'expo-haptics';
import { router } from 'expo-router';
import { StyleSheet, type ViewStyle } from 'react-native';
import { SOFTWARE_VERSION } from '@dems/shared/sim';
import { RAIL_FOOTER_VERSION } from '@/components/composed/nav';
import { NAV_DIMENSIONS } from '@/layout';
import { haptics, MOBILE_PREFS_KEY } from '@/motion';
import { getMissingKeys, resetMissingKeys } from '@/i18n';

jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));

// Counts mounts of the Evidence list, to prove rotation does not remount the open screen.
const evidenceMounts = { count: 0 };
jest.mock('@/features/evidence/evidence-list-screen', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  const { SafeScreen } = jest.requireActual<typeof import('@/layout')>('@/layout');
  return {
    EvidenceListScreen: ({ selectedId }: { selectedId: string | null }) => {
      useEffect(() => {
        evidenceMounts.count += 1;
      }, []);
      return <SafeScreen id="evidence">{selectedId}</SafeScreen>;
    },
  };
});

const PHONE_ITEMS = ['home', 'sessions', 'evidence', 'devices', 'more'];
const TABLET_ITEMS = ['home', 'sessions', 'evidence', 'devices', 'storage', 'network-time', 'audit', 'settings'];

function signedIn(): FakeRuntime {
  const runtime = new FakeRuntime();
  runtime.signInAs();
  return runtime;
}

function navItems(containerId: 'nav-bottom' | 'nav-rail'): string[] {
  return within(screen.getByTestId(containerId))
    .queryAllByRole('tab')
    .map((node) => String(node.props.testID).replace('nav-item-', ''));
}

function selectedItem(containerId: 'nav-bottom' | 'nav-rail'): string | null {
  const selected = within(screen.getByTestId(containerId))
    .queryAllByRole('tab')
    .filter((node) => node.props.accessibilityState?.selected);
  return selected.length === 1 ? String(selected[0]!.props.testID).replace('nav-item-', '') : null;
}

function widthOf(testID: string): number | undefined {
  return (StyleSheet.flatten(screen.getByTestId(testID).props.style) as ViewStyle).width as number | undefined;
}

const originalFetch = global.fetch;

beforeEach(async () => {
  resetShellState();
  haptics.reset();
  jest.mocked(selectionAsync).mockClear();
  evidenceMounts.count = 0;
  await AsyncStorage.clear();
  global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('phone portrait: bottom tab bar (compact)', () => {
  it('shows the five mockup destinations with Home active', () => {
    renderApp('/home', { runtime: signedIn() });
    expect(screen.queryByTestId('nav-rail')).toBeNull();
    expect(navItems('nav-bottom')).toEqual(PHONE_ITEMS);
    expect(selectedItem('nav-bottom')).toBe('home');
    expect(screen.getByTestId('nav-bottom').props.accessibilityRole).toBe('tablist');
  });

  it('switches tabs on press with one selection haptic', () => {
    const app = renderApp('/home', { runtime: signedIn() });
    fireEvent.press(screen.getByTestId('nav-item-evidence'));
    expect(app.getPathname()).toBe('/evidence');
    expect(selectedItem('nav-bottom')).toBe('evidence');
    expect(selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('pads the bottom inset in the bar, so the screen above does not (04 §2.6)', () => {
    renderApp('/home', { runtime: signedIn() });
    const bar = StyleSheet.flatten(screen.getByTestId('nav-bottom').props.style) as ViewStyle;
    expect(bar.height).toBe(NAV_DIMENSIONS.bottomBarHeight + TEST_INSETS.bottom);
    expect(bar.paddingBottom).toBe(TEST_INSETS.bottom);
    const home = StyleSheet.flatten(screen.getByTestId('screen-home').props.style) as ViewStyle;
    expect(home.paddingBottom).toBe(0);
    expect(home.paddingTop).toBe(TEST_INSETS.top);
  });

  it('reaches the More destinations without a visible trigger, highlights More, and goes back through history', () => {
    const app = renderApp('/more', { runtime: signedIn() });
    expect(screen.queryByTestId('nav-item-storage')).toBeNull();
    act(() => router.push('/storage'));
    expect(app.getPathname()).toBe('/storage');
    expect(screen.getByTestId('screen-storage')).toBeTruthy();
    expect(selectedItem('nav-bottom')).toBe('more');
    act(() => router.back());
    expect(app.getPathname()).toBe('/more');
  });
});

describe('rails (compact-landscape, medium, expanded)', () => {
  it('phone landscape: an icon-only 72 dp rail with the five destinations, past the cutout inset', () => {
    renderApp('/evidence', { runtime: signedIn(), window: 'phoneLandscape' });
    expect(screen.queryByTestId('nav-bottom')).toBeNull();
    expect(navItems('nav-rail')).toEqual(PHONE_ITEMS);
    expect(widthOf('nav-rail')).toBe(NAV_DIMENSIONS.compactRail + TEST_INSETS.left);
    // Labels stay as accessible names only.
    expect(within(screen.getByTestId('nav-rail')).queryByText('Evidence')).toBeNull();
    expect(screen.getByTestId('nav-item-evidence').props.accessibilityLabel).toBe('Evidence');
    expect(selectedItem('nav-rail')).toBe('evidence');
  });

  it('tablet portrait: an 88 dp rail with eight labelled destinations and no More', () => {
    renderApp('/network-time', { runtime: signedIn(), window: 'tabletPortrait' });
    expect(navItems('nav-rail')).toEqual(TABLET_ITEMS);
    expect(widthOf('nav-rail')).toBe(NAV_DIMENSIONS.rail + TEST_INSETS.left);
    expect(within(screen.getByTestId('nav-rail')).getByText('Network & Time')).toBeTruthy();
    expect(selectedItem('nav-rail')).toBe('network-time');
  });

  it('tablet landscape: the 232 dp extended rail with the version foot, collapsible and persisted by merge', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ reduceMotion: true, haptics: false }));
    renderApp('/home', { runtime: signedIn(), window: 'tabletLandscape' });
    expect(widthOf('nav-rail')).toBe(NAV_DIMENSIONS.extendedRail + TEST_INSETS.left);
    expect(screen.getByTestId('nav-rail-footer')).toHaveTextContent(`DEMS EDGE CLIENT · v${RAIL_FOOTER_VERSION}`);

    await act(async () => {
      fireEvent.press(screen.getByTestId('nav-rail-collapse'));
    });
    expect(widthOf('nav-rail')).toBe(NAV_DIMENSIONS.rail + TEST_INSETS.left);
    expect(screen.queryByTestId('nav-rail-footer')).toBeNull();
    await waitFor(async () => {
      expect(JSON.parse((await AsyncStorage.getItem(MOBILE_PREFS_KEY))!)).toEqual({
        reduceMotion: true,
        haptics: false,
        railCollapsed: true,
      });
    });
  });

  it('restores a persisted collapsed rail', async () => {
    await AsyncStorage.setItem(MOBILE_PREFS_KEY, JSON.stringify({ railCollapsed: true }));
    renderApp('/home', { runtime: signedIn(), window: 'tabletLandscape' });
    await waitFor(() => expect(widthOf('nav-rail')).toBe(NAV_DIMENSIONS.rail + TEST_INSETS.left));
  });

  it('shows the simulator dataset version at the rail foot (web parity)', () => {
    expect(RAIL_FOOTER_VERSION).toBe(SOFTWARE_VERSION);
  });
});

describe('rotation (04 §2.5, MA-13 chrome part)', () => {
  it('swaps the chrome without remounting the open screen or losing its selection', () => {
    const app = renderApp('/evidence', { runtime: signedIn(), window: 'tabletLandscape' });
    act(() => router.setParams({ selected: 'EV-20261001-0007' }));
    expect(evidenceMounts.count).toBe(1);

    setWindow('tabletPortrait');
    expect(screen.getByTestId('nav-rail')).toBeTruthy();
    expect(app.getSearchParams()).toEqual({ selected: 'EV-20261001-0007' });
    expect(evidenceMounts.count).toBe(1);
  });

  it('phone: bottom bar ↔ rail keeps the same screen instance', () => {
    renderApp('/evidence', { runtime: signedIn(), window: 'phonePortrait' });
    expect(screen.getByTestId('nav-bottom')).toBeTruthy();
    setWindow('phoneLandscape');
    expect(screen.getByTestId('nav-rail')).toBeTruthy();
    setWindow('phonePortrait');
    expect(screen.getByTestId('nav-bottom')).toBeTruthy();
    expect(evidenceMounts.count).toBe(1);
  });
});

describe('master-detail (04 §2.5 rule 3)', () => {
  it('a tablet hands a detail URL over to the list pane', () => {
    const app = renderApp('/evidence/EV-20261001-0007', { runtime: signedIn(), window: 'tabletLandscape' });
    expect(app.getPathname()).toBe('/evidence');
    // Global params still carry the deep link's path param on the parent tab route (Expo Router
    // behaviour); the list route's own params are replaced, so the list gets only the selection.
    expect(app.getSearchParams()).toMatchObject({ selected: 'EV-20261001-0007' });
    expect(screen.getByTestId('screen-evidence')).toHaveTextContent('EV-20261001-0007');
  });

  it('a phone turns a selection into a pushed detail; Back returns to the plain list', () => {
    const app = renderApp('/devices?selected=CAM-02', { runtime: signedIn() });
    expect(app.getPathname()).toBe('/devices/CAM-02');
    // The real Device detail (step 84) shows the pushed ID (step 70's stub printed it as a param).
    // PIN MOVED by audit row 229 (D255/D257): this harness runs the default LIVE link against no Core (fetch 503), so the
    // Core states no selector line (0 devices, 0 camera / mic lines). A built-in detail shows the device its SLOT holds - none here -
    // so it reads "Not assigned", not the seed's fixed id. The simulated lane still shows the built-in id (devices-screen.test.tsx).
    expect(screen.getByTestId('device-detail-id')).toHaveTextContent('Not assigned');
    act(() => router.back());
    expect(app.getPathname()).toBe('/devices');
    expect(app.getSearchParams()).toEqual({});
  });

  it('a tablet opens a Settings section in the list pane', () => {
    const app = renderApp('/settings/about', { runtime: signedIn(), window: 'tabletPortrait' });
    expect(app.getPathname()).toBe('/settings');
    // The real Settings (step 88) opens About in its section pane (the default is App Preferences).
    const pane = within(screen.getByTestId('pane-section'));
    expect(pane.getByTestId('settings-about')).toBeTruthy();
    expect(pane.queryByTestId('settings-preferences')).toBeNull();
  });
});

describe('live mini-bar (04 §3.8)', () => {
  it('appears above the bar while recording and opens the monitor', () => {
    const runtime = signedIn();
    runtime.setSession('RECORDING', 'S-20261001-0009', Date.now() - 65_000);
    const app = renderApp('/evidence', { runtime });
    const bar = screen.getByTestId('nav-mini-bar');
    expect(bar).toHaveTextContent(/Recording/);
    expect(bar).toHaveTextContent(/S-20261001-0009/);
    fireEvent.press(bar);
    expect(app.getPathname()).toBe('/session/live');
    expect(screen.getByTestId('screen-session-live')).toBeTruthy();
  });

  it('sits at the top of the content column on a tablet, and hides when the recording ends', () => {
    const runtime = signedIn();
    runtime.setSession('RECORDING', 'S-20261001-0009', Date.now());
    renderApp('/home', { runtime, window: 'tabletLandscape' });
    expect(screen.getByTestId('nav-mini-bar')).toBeTruthy();
    runtime.setSession('FINALIZING');
    // FINALIZING is not RECORDING: no mini-bar (the resync to /session/finalizing is the runtime's).
    expect(screen.queryByTestId('nav-mini-bar')).toBeNull();
  });

  it('is absent while idle', () => {
    renderApp('/home', { runtime: signedIn() });
    expect(screen.queryByTestId('nav-mini-bar')).toBeNull();
  });
});

describe('copy', () => {
  it('resolves every chrome string through i18n (MA-21)', () => {
    resetMissingKeys();
    renderApp('/home', { runtime: signedIn(), window: 'tabletLandscape' });
    setWindow('phonePortrait');
    expect(getMissingKeys()).toEqual([]);
  });
});
