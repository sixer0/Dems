// Fix wave H, closing pass Z2 (driver A's request line of 10:20:55Z, item 3: "the Summary Start / End
// chips say GNSS from the simulator's `time` slice"; ruling D203 (1); closing pass Z1's line of
// 10:30:00Z). The two time-source chips of the Session Summary repeat the time source of the session.
//
// | Rule | Case |
// |------|------|
// | The chip reads THE SESSION'S OWN MEMBER (`startTimeSource` / `endTimeSource` of its history entry) when the Core states it; the ring of the live `time` slice is only the fallback of an entry without the members | "the member wins" |
// | On a Core whose time is the host system clock (`time.hostClock`) an `RTC` member reads "Host system clock", in a neutral chip - never "GNSS", never a success mark | "host clock" |
// | CONTROL: the simulator's sealed session keeps its GNSS chips | both |
//
// Import order matters: the gorhom mock, then the router harness.
import '@/features/session-finalizing/testing/flow-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, screen, within } from '@testing-library/react-native';
import type { Sim } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { renderFlowApp, settle } from '@/features/session-finalizing/testing/flow-harness';
import { resetStampedForTests } from './stamp-once';
import { summaryTimeSource } from './summary.model';

beforeEach(() => {
  resetMissingKeys();
  resetStampedForTests();
});
afterEach(() => {
  resetMotionStateForTests();
  expect(getMissingKeys()).toEqual([]);
});

const HOST_CLOCK = { hostClock: true, source: 'RTC', locked: false, stratum: 0, offsetMs: 0, lastSyncAt: 0, gnss: { locked: false, satellites: 0 }, ntp: { server: '', reachable: false, stratum: 0 }, rtc: { driftPpm: 0 }, history: [] };
const setEntry = (sim: Sim, sessionId: string, patch: Record<string, unknown>) =>
  act(() => sim.store.setState((s) => ({ sessionHistory: s.sessionHistory.map((entry) => (entry.id === sessionId ? { ...entry, ...patch } : entry)) })));
const chipsOf = (testID: 'summary-start' | 'summary-end') => within(screen.getByTestId(testID));

describe('the time-source chips of the Session Summary', () => {
  it('the member wins: an entry that says RTC reads RTC although the live slice\'s ring says GNSS', async () => {
    const h = renderFlowApp({ scenario: 'sealed' });
    await settle();
    // CONTROL: the simulator's sealed session.
    expect(chipsOf('summary-start').getByText('GNSS')).toBeTruthy();
    expect(chipsOf('summary-end').getByText('GNSS')).toBeTruthy();

    setEntry(h.sim, h.sessionId!, { startTimeSource: 'RTC', endTimeSource: 'RTC' });
    await settle();
    for (const id of ['summary-start', 'summary-end'] as const) {
      expect(chipsOf(id).queryByText('GNSS')).toBeNull();
      expect(chipsOf(id).getByText('RTC')).toBeTruthy();
    }
  });

  it('host clock: a Core in its own capture reads "Host system clock" on both chips - no GNSS, no RTC code', async () => {
    const h = renderFlowApp({ scenario: 'sealed' });
    await settle();
    setEntry(h.sim, h.sessionId!, { startTimeSource: 'RTC', endTimeSource: 'RTC' });
    act(() => h.sim.store.setState({ time: HOST_CLOCK as never }));
    await settle();
    for (const id of ['summary-start', 'summary-end'] as const) {
      expect(chipsOf(id).getByText('Host system clock')).toBeTruthy();
      expect(chipsOf(id).queryByText('GNSS')).toBeNull();
      expect(chipsOf(id).queryByText('RTC')).toBeNull();
      expect(chipsOf(id).getByLabelText('Time source Host system clock')).toBeTruthy();
    }
  });

  it('the rule (pure)', () => {
    // The member, else the ring; null when neither knows.
    expect(summaryTimeSource({ member: 'RTC', ring: 'GNSS', hostClock: false })).toEqual({ source: 'RTC', host: false });
    expect(summaryTimeSource({ member: null, ring: 'GNSS', hostClock: false })).toEqual({ source: 'GNSS', host: false });
    expect(summaryTimeSource({ member: undefined, ring: null, hostClock: false })).toBeNull();
    // The host clock names an RTC member; a member that says otherwise is repeated as stated.
    expect(summaryTimeSource({ member: 'RTC', ring: null, hostClock: true })).toEqual({ source: 'RTC', host: true });
    expect(summaryTimeSource({ member: 'GNSS', ring: null, hostClock: true })).toEqual({ source: 'GNSS', host: false });
    // The host clock keeps no ring: nothing is read from it there.
    expect(summaryTimeSource({ member: null, ring: 'GNSS', hostClock: true })).toBeNull();
  });
});
