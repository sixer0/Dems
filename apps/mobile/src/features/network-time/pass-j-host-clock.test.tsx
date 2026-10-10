// Closing pass J of fix wave I (note 134, open item; finding G75b-06, ruling D203 (1)): the mobile
// Network & Time screen worded the host system clock of a Core in its own capture as "RTC (holdover)",
// "Free-running", "GNSS: no fix" and a last synchronisation of 1970. Such a Core has no time service:
// the screen names the clock (`time.hostClock`, read by `isHostClockTime`) and states nothing measured.
// The Core's slice is the shared constant `HOST_CLOCK_TIME`, never a retyped payload.
import './testing/network-time-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { en } from '@dems/shared/i18n';
import { HOST_CLOCK_TIME, createSim, createManualClock } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { selectTimeView } from './network-time-model';
import { renderNetworkTimeApp, settle } from './testing/network-time-harness';

const H = en.common.hostClockTime;

function allText(testID: string): string {
  const parts: string[] = [];
  const walk = (n: ReactTestInstance | string) => {
    if (typeof n === 'string') parts.push(n);
    else n.children.forEach(walk);
  };
  walk(screen.getAllByTestId(testID)[0]!);
  return parts.join(' ');
}

beforeEach(() => {
  resetMissingKeys();
});
afterEach(() => {
  resetMotionStateForTests();
});

describe('G75b-06 mobile Network & Time: a Core in its own capture', () => {
  it('the rule: `time.hostClock` is read by name into the view', () => {
    const sim = createSim({ clock: createManualClock(Date.UTC(2026, 9, 1, 3, 0, 0)), storage: null, authStorage: null });
    expect(selectTimeView(sim.store.getState()).hostClock).toBe(false);
    sim.store.setState({ time: { ...HOST_CLOCK_TIME } });
    expect(selectTimeView(sim.store.getState())).toMatchObject({ hostClock: true, source: 'RTC' });
    sim.stop();
  });

  it('the time card, the system-time chip and the header chip name the host system clock - no "RTC (holdover)", no tier, no orbit, no last sync, no server', async () => {
    const h = renderNetworkTimeApp();
    await settle();
    act(() => h.sim.store.setState({ time: { ...HOST_CLOCK_TIME } }));
    await settle();

    const card = allText('network-time-time');
    expect(card).toContain(H.value);
    expect(card).toContain(H.notice);
    expect(card).not.toMatch(/holdover|RTC \(|GNSS \/ NTP|Last Sync|Server|1970/);
    expect(screen.getByTestId('network-time-host-clock')).toBeTruthy();
    expect(screen.queryByTestId('network-time-last-sync')).toBeNull();
    expect(screen.queryByTestId('network-time-source')).toBeNull();
    expect(screen.queryByTestId('network-time-server')).toBeNull();
    expect(screen.queryByTestId('network-time-orbit')).toBeNull();
    expect(screen.queryByTestId('network-time-tier-RTC')).toBeNull();
    expect(allText('network-time-system-time')).toContain(H.value);
    expect(allText('network-time-system-time')).not.toMatch(/Free-running|Synchronized/);
    expect(getMissingKeys()).toEqual([]);
  });

  it('CONTROL - the simulated time service keeps its rows, its tiers and "Synchronized"; an RTC fallback of the simulation still reads "RTC (holdover)"', async () => {
    const h = renderNetworkTimeApp();
    await settle();
    expect(screen.getByTestId('network-time-last-sync')).toBeTruthy();
    expect(screen.getByTestId('network-time-tier-GNSS')).toBeTruthy();
    expect(screen.queryByTestId('network-time-host-clock')).toBeNull();
    expect(allText('network-time-system-time')).toContain('Synchronized');
    act(() => h.sim.store.setState((s) => ({ time: { ...s.time, source: 'RTC', locked: false } })));
    await settle();
    expect(allText('network-time-source')).toContain('RTC (holdover)');
  });
});
