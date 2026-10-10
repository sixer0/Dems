// Fix wave K, driver M2 - G81b-08 (tablet Session Live: the recording clock half covered by the
// Audio Monitor card) and G75c-10 (the notice of an interrupted recording says "Sealed —" at 0 %).
//
// THE LAYOUT RULE of the tablet's clock: its place is a slot of a FIXED height - the line height of
// the digits it draws - that exists from the first layout, also while the cameras connect and no
// timer is mounted (D84). The column below never has to move when the clock appears: on the tablet
// the card had kept the height it had while connecting. jest computes no layout, so the test holds
// the rule itself: the slot is there in both phases, with the same declared height, and that height
// is the digits' line height.
//
// Import order matters: the gorhom mock, then the router harness.
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it } from '@jest/globals';
import { act, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { typography } from '@dems/shared/tokens';
import { InterruptedSealNotice } from '@/features/session-finalizing/interrupted-seal';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { MONITOR_TIMER_SLOT_HEIGHT } from './session-live-screen';
import { renderMonitorApp, settle, type MonitorHarness } from './testing/monitor-harness';

afterEach(() => {
  resetMotionStateForTests();
  expect(getMissingKeys()).toEqual([]);
  resetMissingKeys();
});

const setDurable = (h: MonitorHarness, captureDurable: boolean) => act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable } })));
const slotHeight = (): number | undefined => (StyleSheet.flatten(screen.getAllByTestId('monitor-timer-slot')[0]!.props.style) as { height?: number }).height;

describe('G81b-08 - the tablet\'s recording clock has a reserved place', () => {
  it('the slot is the height of the clock\'s digits', () => {
    expect(MONITOR_TIMER_SLOT_HEIGHT).toBe(typography.display.lineHeight);
    expect(MONITOR_TIMER_SLOT_HEIGHT).toBeGreaterThan(0);
  });

  it('tabletLandscape: the slot has the same height while the cameras connect (no timer) and while recording (the timer inside it)', async () => {
    const h = renderMonitorApp({ window: 'tabletLandscape' });
    await settle();
    h.openMonitor();
    // Recording: the clock is drawn INSIDE the slot.
    expect(slotHeight()).toBe(MONITOR_TIMER_SLOT_HEIGHT);
    expect(within(screen.getAllByTestId('monitor-timer-slot')[0]!).queryAllByTestId('monitor-timer').length).toBeGreaterThan(0);
    // Connecting: no timer (D84) - and the slot keeps its full height, so nothing moves when the clock comes.
    setDurable(h, false);
    expect(screen.queryAllByTestId('monitor-timer')).toHaveLength(0);
    expect(slotHeight()).toBe(MONITOR_TIMER_SLOT_HEIGHT);
    setDurable(h, true);
    expect(slotHeight()).toBe(MONITOR_TIMER_SLOT_HEIGHT);
    expect(within(screen.getAllByTestId('monitor-timer-slot')[0]!).queryAllByTestId('monitor-timer').length).toBeGreaterThan(0);
  });

  it('CONTROL: the phone draws its clock in the recording row (no slot - the row has its own minimum height)', async () => {
    const h = renderMonitorApp({ window: 'phonePortrait' });
    await settle();
    h.openMonitor();
    expect(screen.queryAllByTestId('monitor-timer-slot')).toHaveLength(0);
    expect(screen.queryAllByTestId('monitor-timer').length).toBeGreaterThan(0);
  });
});

describe('G75c-10 - the interrupted recording while its seal runs', () => {
  function interruptedSession() {
    const test = createTestSim({ scenario: 'recording' });
    expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
    const session = test.sim.store.getState().session!;
    // As the Core sends it: the recording ended at a capture fault and the session is being sealed.
    act(() =>
      test.sim.store.setState({
        session: { ...session, state: 'FINALIZING', stoppedAt: test.clock.now(), fault: { ...(session.fault ?? {}), kind: 'CAPTURE_FAULT', fromState: 'RECORDING', at: test.clock.now() } },
      } as never),
    );
    return { test, sessionId: session.id };
  }

  it('while the seal runs the notice does NOT say "Sealed": "Recording was interrupted — sealing what was recorded"', async () => {
    const { test, sessionId } = interruptedSession();
    renderWithRuntime(<InterruptedSealNotice sessionId={sessionId} testID="notice" sealing />, { sim: test.sim });
    await flushAsync();
    expect(within(screen.getByTestId('notice')).getByText('Recording was interrupted — sealing what was recorded')).toBeTruthy();
    expect(screen.queryByText(/^Sealed/)).toBeNull();
  });

  it('CONTROL: a finished seal keeps "Sealed — recording was interrupted"', async () => {
    const { test, sessionId } = interruptedSession();
    renderWithRuntime(<InterruptedSealNotice sessionId={sessionId} testID="notice" />, { sim: test.sim });
    await flushAsync();
    expect(within(screen.getByTestId('notice')).getByText('Sealed — recording was interrupted')).toBeTruthy();
  });
});

describe('G75c-06 - the timeline row of a capture fault (contract_wave_k.md S1 section 6)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { captureFaultRowDetail, timelineItems } = require('./session-live.math') as typeof import('./session-live.math');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { captureFaultSentence } = require('@dems/shared/sim') as typeof import('@dems/shared/sim');
  const row = (params: Record<string, unknown> | null) => ({ id: 'T-1', at: 1, kind: 'FAULT' as const, label: 'Fault Detected', detail: 'The capture stopped unexpectedly before the recording was ended. The recording was interrupted.', params });

  it('the row\'s own `params.reason` words it: the demo fault "is not affected", a killed worker says so - never "was interrupted" for both', () => {
    const demo = timelineItems([row({ kind: 'CAPTURE_FAULT', reason: 'DEMO_CAPTURE_FAULT' })])[0]!.detail;
    const killed = timelineItems([row({ kind: 'CAPTURE_FAULT', reason: 'WORKER_KILLED' })])[0]!.detail;
    expect(demo).toBe(captureFaultSentence('DEMO_CAPTURE_FAULT', null));
    expect(demo).toMatch(/The recording is not affected\./);
    expect(demo).not.toMatch(/interrupted/);
    expect(killed).toBe(captureFaultSentence('WORKER_KILLED', null));
    expect(killed).not.toBe(demo);
  });

  it('a capture-fault row WITHOUT a reason reads the no-reason sentence; CONTROL: any other row keeps its own text', () => {
    expect(captureFaultRowDetail(row({ kind: 'CAPTURE_FAULT' }))).toBe(captureFaultSentence(null, null));
    expect(captureFaultRowDetail(row({ kind: 'POWER_FAIL' }))).toBeNull();
    expect(captureFaultRowDetail({ kind: 'NOTE', params: { kind: 'CAPTURE_FAULT', reason: 'WORKER_KILLED' } })).toBeNull();
    expect(timelineItems([{ id: 'T-2', at: 1, kind: 'NOTE', label: 'Note', detail: 'hello' }])[0]!.detail).toBe('Note · hello');
  });
});

describe('G89b-01 on the tablet and the phone - the picture format beside a recording (contract_wave_k.md S1 section 3)', () => {
  for (const window of ['phonePortrait', 'tabletLandscape'] as const) {
    it(`${window}: "1080p • 25 fps" is drawn for the simulated camera and NOT beside a recording of the Core's own capture`, async () => {
      const h = renderMonitorApp({ window });
      await settle();
      h.openMonitor();
      // SIMULATED, pinned: the simulated camera keeps its format chip.
      expect(screen.queryAllByTestId('monitor-feed-format').length).toBeGreaterThan(0);
      expect(screen.queryAllByText(/1080p/).length).toBeGreaterThan(0);
      // A session of the Core's own capture carries `captureDurable`: the configured profile is not stated as the stream's.
      setDurable(h, true);
      expect(screen.queryAllByTestId('monitor-feed-format')).toHaveLength(0);
      expect(screen.queryAllByText(/1080p/)).toHaveLength(0);
    });
  }
});
