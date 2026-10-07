// Network & Time screen (step 86; 04_mobile_specs §4.14, MB 9; 03M M-PG-NET; MA-11 MB 9 checklist).
// Renders the real `/network-time` route with a test simulator signed in as a demo operator.
// Import order: the module mocks, the router harness, the feature harness.
import './testing/network-time-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { activeLoopNames, resetMotionStateForTests } from '@/motion';
import { barHeight } from './bandwidth-bars';
import { bandwidthScaleMax, bandwidthWindow } from './network-time-model';
import { renderNetworkTimeApp, settle } from './testing/network-time-harness';

/** Independent UTC+07:00 rendering (no shared formatter), for the MA-11 "UTC+07:00 times" check. */
function wib(ms: number) {
  const d = new Date(ms + 7 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const time = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
  return {
    time,
    dateTime: `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${time}`,
    weekdayDate: `${days[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
  };
}

function textOf(testID: string): string {
  const node = screen.getByTestId(testID);
  const children = node.props.children as unknown;
  return Array.isArray(children) ? children.join('') : String(children);
}

function tierSelected(tier: 'GNSS' | 'NTP' | 'RTC'): boolean {
  return Boolean((screen.getByTestId(`network-time-tier-${tier}`).props.accessibilityState as { selected?: boolean }).selected);
}

beforeEach(() => {
  resetMissingKeys();
});

afterEach(() => {
  resetMotionStateForTests();
});

describe('Network & Time (04 §4.14, MB 9)', () => {
  it('renders the MB 9 regions in order with UTC+07:00 times from the shared formatter', async () => {
    const h = renderNetworkTimeApp();
    await settle();
    const state = h.sim.store.getState();

    expect(screen.getByTestId('screen-network-time')).toBeTruthy();
    // N1 header: back + title.
    expect(screen.getByTestId('network-time-back')).toBeTruthy();
    expect(screen.getByText('Network & Time')).toBeTruthy();

    // Region order on the phone: N2 Network Status, N3 Time Synchronization, N4 System Time.
    const ids = screen
      .UNSAFE_root.findAll((node) => typeof node.props.testID === 'string' && /^network-time-(network|time|system-time)$/.test(node.props.testID as string) && typeof node.type === 'string')
      .map((node) => node.props.testID as string);
    expect(ids).toEqual(['network-time-network', 'network-time-time', 'network-time-system-time']);

    // N2: LAN Connected, PoE Active, bandwidth "12.4 Mbps" / "↑ 3.1 Mbps".
    const network = within(screen.getByTestId('network-time-network'));
    expect(network.getByText('Network Status')).toBeTruthy();
    expect(network.getByText('LAN Connection')).toBeTruthy();
    expect(within(screen.getByTestId('network-time-lan-chip')).getByText('Connected')).toBeTruthy();
    expect(network.getByText('PoE Network')).toBeTruthy();
    expect(within(screen.getByTestId('network-time-poe-chip')).getByText('Active')).toBeTruthy();
    // The readout is the newest bandwidth sample (the slice's 12.4 / 3.1 before the first sample).
    const bw = bandwidthWindow(state.network.bandwidth.history, state.network.bandwidth, null);
    expect(screen.getByTestId('network-time-bandwidth-readout').props.accessibilityLabel).toBe(
      `Bandwidth ${bw.downMbps.toFixed(1)} Mbps down, ${bw.upMbps.toFixed(1)} Mbps up`,
    );
    expect(network.getByText(`↑ ${bw.upMbps.toFixed(1)} Mbps`)).toBeTruthy();

    // N3: GNSS / NTP Synchronized + UTC+07:00; Last Sync; Time Source; Server.
    expect(screen.getByText('Time Synchronization')).toBeTruthy();
    expect(within(screen.getByTestId('network-time-sync-chip')).getByText('Synchronized')).toBeTruthy();
    expect(textOf('network-time-zone')).toBe('UTC+07:00');
    expect(textOf('network-time-last-sync-value')).toBe(wib(state.time.lastSyncAt).dateTime);
    expect(textOf('network-time-source-value')).toBe('GPS (GNSS Stratum-1)');
    expect(textOf('network-time-server-value')).toBe('192.168.10.1');
    expect(tierSelected('GNSS')).toBe(true);

    // N4: date in gold + the clock, both UTC+07:00 of the sim clock.
    const now = wib(Math.floor(state.clock.now / 1000) * 1000);
    expect(textOf('network-time-date')).toBe(now.weekdayDate);
    expect(screen.getByTestId('network-time-clock').props.accessibilityLabel).toBe(`System time ${now.time}, UTC+07:00, ${now.weekdayDate}`);
    expect(within(screen.getByTestId('network-time-system-chip')).getByText('Synchronized')).toBeTruthy();

    // The GNSS orbit is the screen's ambient loop (P3 cap of 4).
    expect(activeLoopNames()).toContain('network-time-orbit');
    expect(activeLoopNames().length).toBeLessThanOrEqual(4);
    expect(getMissingKeys()).toEqual([]);
  });

  it('streams the 12 bandwidth bars at 1 Hz from the simulator (no invented points)', async () => {
    const h = renderNetworkTimeApp();
    await settle();
    const heights = () =>
      Array.from({ length: 12 }, (_, i) => StyleSheet.flatten(screen.getByTestId(`network-time-bandwidth-bars-${i}`).props.style).height as number);
    const expected = () => {
      const { bandwidth } = h.sim.store.getState().network;
      const bw = bandwidthWindow(bandwidth.history, bandwidth, null);
      return { bw, heights: bw.bars.map((value) => barHeight(value, bandwidthScaleMax(bw.bars))), newestAt: bandwidth.history.at(-1)?.at ?? 0 };
    };
    expect(screen.queryByTestId('network-time-bandwidth-bars-12')).toBeNull();
    const before = expected();
    expect(heights()).toEqual(before.heights);
    act(() => h.advance(3_000));
    const after = expected();
    // Three 1 Hz samples arrived and the bars show exactly the newest 12 (left-padded while fewer).
    expect(after.newestAt - before.newestAt).toBeGreaterThanOrEqual(2_000);
    expect(after.bw.samples).toBeGreaterThanOrEqual(Math.min(12, before.bw.samples + 2));
    expect(heights()).toEqual(after.heights);
    expect(heights()[11]).toBeGreaterThan(0);
    expect(screen.getByTestId('network-time-bandwidth-readout').props.accessibilityLabel).toBe(
      `Bandwidth ${after.bw.downMbps.toFixed(1)} Mbps down, ${after.bw.upMbps.toFixed(1)} Mbps up`,
    );
  });

  it('GNSS loss → NTP → RTC → restored: the tier indicator moves, chips escalate calmly, 1 toast per change (its drawn count does not grow on later ticks)', async () => {
    const h = renderNetworkTimeApp();
    await settle();
    const toastCount = (text: string) => screen.queryAllByText(text).length;

    act(() => h.sim.actions.inject('GNSS_LOSS'));
    act(() => h.advance(1_000));
    expect(tierSelected('NTP')).toBe(true);
    expect(tierSelected('GNSS')).toBe(false);
    expect(within(screen.getByTestId('network-time-tier-GNSS')).getByText('Signal lost')).toBeTruthy();
    expect(within(screen.getByTestId('network-time-sync-chip')).getByText('NTP fallback')).toBeTruthy();
    expect(textOf('network-time-source-value')).toBe('NTP Server (Stratum-3)');
    expect(within(screen.getByTestId('network-time-system-chip')).getByText('Synchronized')).toBeTruthy();
    {
      // W93-17/R16 (FXR-M): one toast, counted: what one toast draws must not grow on the next ticks.
      const drawn = toastCount('GNSS signal lost');
      expect(drawn).toBeGreaterThan(0);
      act(() => h.advance(2_000));
      expect(toastCount('GNSS signal lost')).toBe(drawn);
    }
    // The orbit loop stops while GNSS has no fix.
    expect(activeLoopNames()).not.toContain('network-time-orbit');

    act(() => h.sim.actions.inject('GNSS_LOSS', { fallback: 'RTC' }));
    act(() => h.advance(1_000));
    expect(tierSelected('RTC')).toBe(true);
    expect(within(screen.getByTestId('network-time-tier-NTP')).getByText('Unreachable')).toBeTruthy();
    expect(within(screen.getByTestId('network-time-sync-chip')).getByText('RTC holdover')).toBeTruthy();
    expect(within(screen.getByTestId('network-time-system-chip')).getByText('Free-running')).toBeTruthy();
    {
      // W93-17/R16 (FXR-M): one toast, counted: what one toast draws must not grow on the next ticks.
      const drawn = toastCount('No time reference');
      expect(drawn).toBeGreaterThan(0);
      act(() => h.advance(2_000));
      expect(toastCount('No time reference')).toBe(drawn);
    }

    act(() => h.sim.actions.clearFault('GNSS_LOSS'));
    act(() => h.advance(1_000));
    expect(tierSelected('GNSS')).toBe(true);
    expect(within(screen.getByTestId('network-time-sync-chip')).getByText('Synchronized')).toBeTruthy();
    {
      // W93-17/R16 (FXR-M): one toast, counted: what one toast draws must not grow on the next ticks.
      const drawn = toastCount('GNSS lock restored');
      expect(drawn).toBeGreaterThan(0);
      act(() => h.advance(2_000));
      expect(toastCount('GNSS lock restored')).toBe(drawn);
    }
    expect(activeLoopNames()).toContain('network-time-orbit');
    expect(getMissingKeys()).toEqual([]);
  });

  it('the LAN row opens the LAN Connection detail sheet', async () => {
    renderNetworkTimeApp();
    await settle();
    fireEvent.press(screen.getByTestId('network-time-lan'));
    await settle();
    const sheet = within(screen.getByTestId('network-time-lan-sheet'));
    expect(sheet.getByText('LAN Connection')).toBeTruthy();
    expect(screen.getByText('192.168.10.21')).toBeTruthy();
    expect(screen.getByText('1 Gbps')).toBeTruthy();
    expect(screen.getByText('18.6 W of 60 W budget')).toBeTruthy();
    expect(getMissingKeys()).toEqual([]);
  });

  it('tablet: network and time side by side (portrait under the System Time hero; landscape 3 panes)', async () => {
    renderNetworkTimeApp({ window: 'tabletPortrait' });
    await settle();
    expect(screen.getByTestId('pane-network')).toBeTruthy();
    expect(screen.getByTestId('pane-time')).toBeTruthy();
    expect(screen.queryByTestId('network-time-back')).toBeNull();
    expect(within(screen.getByTestId('network-time-header-time')).getByText('Synchronized')).toBeTruthy();
    expect(within(screen.getByTestId('network-time-header-lan')).getByText('Connected')).toBeTruthy();
    expect(screen.getByTestId('network-time-panes').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ flexDirection: 'row' })]));
  });

  it('tablet landscape: System Time | Network | Time', async () => {
    renderNetworkTimeApp({ window: 'tabletLandscape' });
    await settle();
    for (const pane of ['system-time', 'network', 'time']) expect(screen.getByTestId(`pane-${pane}`)).toBeTruthy();
    expect(getMissingKeys()).toEqual([]);
  });
});
