// Home through the REAL route tree (step 70's harness; must be the first import): `/home` renders
// the Dashboard inside the tab chrome on every layout class, with the MA-12 ids on the tablet
// (`nav-rail` with 8 destinations, the `pane-*` zones) and the MB 2 regions on the phone.
import { FakeRuntime, renderApp, resetShellState } from '@/navigation/testing/router-harness';
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cleanup, screen, within } from '@testing-library/react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';

function signedIn(): FakeRuntime {
  const runtime = new FakeRuntime();
  runtime.signInAs('budi.santoso');
  return runtime;
}

describe('/home in the route tree', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetShellState();
    resetMissingKeys();
  });
  afterEach(() => {
    cleanup();
  });

  it('phone portrait: bottom bar with Home selected, MB 2 regions', async () => {
    const view = renderApp('/home', { runtime: signedIn(), window: 'phonePortrait' });
    expect(await screen.findByTestId('screen-home')).toBeTruthy();
    expect(view.getPathname()).toBe('/home');
    expect(within(screen.getByTestId('nav-bottom')).getByTestId('nav-item-home').props.accessibilityState?.selected).toBe(true);
    for (const id of ['home-header', 'home-status', 'home-tiles', 'home-actions', 'home-recent']) {
      expect(screen.getByTestId(id)).toBeTruthy();
    }
    expect(getMissingKeys()).toEqual([]);
  });

  it('tablet landscape (MA-12 home part): nav-rail with 8 items and the pane-status / pane-devices / pane-activity zones', async () => {
    renderApp('/home', { runtime: signedIn(), window: 'tabletLandscape' });
    const home = within(await screen.findByTestId('screen-home'));
    expect(within(screen.getByTestId('nav-rail')).queryAllByRole('tab')).toHaveLength(8);
    for (const pane of ['pane-status', 'pane-devices', 'pane-activity']) {
      expect(home.getByTestId(pane)).toBeTruthy();
    }
    expect(home.getByTestId('home-status-ring-state')).toBeTruthy();
    expect(getMissingKeys()).toEqual([]);
  });
});
