// Closing-fix row CF-M2, defect R-P-3 (decision D213): Settings > Device Settings must open the
// Devices list cleanly, and one Back must return to Settings, even when a device detail was left
// open in the Devices tab.
//
// Before the fix the Settings row called `router.push('/devices')`. Expo Router turns that into a
// NAVIGATE on the tab navigator with nested params `{ screen: 'index' }`; the Devices stack, whose
// top route was the detail, pushed a SECOND list on top: [list, detail, list]. Back then showed the
// detail, a second Back the list, a third Back Settings (re-test `45_…`, `38_…`, `39_…`).
//
// The harness must be the first import (see its header).
import { FakeRuntime, renderApp, resetShellState } from '../testing/router-harness';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { setNavigationLogSink, type NavigationLogRecord } from '@/navigation/log';

jest.mock('@/features/home/pulse-ring', () => ({ PulseRing: () => null }));

function signedIn(): FakeRuntime {
  const runtime = new FakeRuntime();
  runtime.signInAs();
  return runtime;
}

const originalFetch = global.fetch;
const records: NavigationLogRecord[] = [];

beforeEach(async () => {
  resetShellState();
  records.length = 0;
  setNavigationLogSink((record) => records.push(record));
  await AsyncStorage.clear();
  global.fetch = jest.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch;
});

afterEach(() => {
  setNavigationLogSink(null);
  global.fetch = originalFetch;
});

describe('R-P-3: Settings > Device Settings opens the Devices list at its root', () => {
  it('phone: with Camera 1 detail left in the Devices stack, the row shows the list and ONE Back returns to Settings', () => {
    const app = renderApp('/devices', { runtime: signedIn() });
    act(() => router.push('/devices/CAM-01'));
    expect(app.getPathname()).toBe('/devices/CAM-01');
    expect(screen.getByTestId('device-detail-id')).toHaveTextContent('CAM-01');

    // More > Settings (More opens it with `router.push`, a tab jump).
    act(() => router.push('/settings'));
    expect(app.getPathname()).toBe('/settings');

    fireEvent.press(screen.getByTestId('settings-row-devices'));
    expect(app.getPathname()).toBe('/devices');
    expect(screen.getByTestId('screen-devices')).toBeTruthy();
    expect(screen.queryByTestId('screen-device-detail')).toBeNull();

    act(() => router.back());
    expect(app.getPathname()).toBe('/settings');
    expect(screen.getByTestId('settings-list')).toBeTruthy();
    expect(records.filter((record) => record.level !== 'info')).toEqual([]);
  });

  it('phone: without a detail in the Devices stack it behaves as before (one Back to Settings)', () => {
    const app = renderApp('/settings', { runtime: signedIn() });
    fireEvent.press(screen.getByTestId('settings-row-devices'));
    expect(app.getPathname()).toBe('/devices');
    act(() => router.back());
    expect(app.getPathname()).toBe('/settings');
  });

  it('phone: the next visit of the Devices tab starts from the list too, and a detail opened afterwards pops back to it', () => {
    const app = renderApp('/devices', { runtime: signedIn() });
    act(() => router.push('/devices/CAM-02'));
    act(() => router.push('/settings'));
    fireEvent.press(screen.getByTestId('settings-row-devices'));
    act(() => router.push('/devices/CAM-01'));
    expect(app.getPathname()).toBe('/devices/CAM-01');
    act(() => router.back());
    expect(app.getPathname()).toBe('/devices');
    act(() => router.back());
    expect(app.getPathname()).toBe('/settings');
  });

  it('tablet: a selection left in the Devices pane is not stacked under the opened list; ONE Back returns to Settings', () => {
    const app = renderApp('/devices?selected=CAM-01', { runtime: signedIn(), window: 'tabletLandscape' });
    expect(app.getPathname()).toBe('/devices');
    expect(app.getSearchParams()).toEqual({ selected: 'CAM-01' });

    act(() => router.push('/settings'));
    fireEvent.press(screen.getByTestId('settings-row-devices'));
    expect(app.getPathname()).toBe('/devices');
    expect(app.getSearchParams()).toEqual({});

    act(() => router.back());
    expect(app.getPathname()).toBe('/settings');
  });

  it('Storage Management and Network & Time still open their screens with one Back to Settings', () => {
    const app = renderApp('/settings', { runtime: signedIn() });
    fireEvent.press(screen.getByTestId('settings-row-storage'));
    expect(app.getPathname()).toBe('/storage');
    act(() => router.back());
    expect(app.getPathname()).toBe('/settings');
    fireEvent.press(screen.getByTestId('settings-row-network-time'));
    expect(app.getPathname()).toBe('/network-time');
    act(() => router.back());
    expect(app.getPathname()).toBe('/settings');
  });
});
