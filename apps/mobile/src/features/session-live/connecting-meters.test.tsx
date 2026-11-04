// Task 3, integration pass D7 item 4, mobile (row 139's leftover, implementation/70 §5 "Also open";
// masterplan/08_client_ux_spec.md §8e.2 "no meter presented as recording"; decisions D84, D91).
//
// Before the first durable fragment the monitor drew its two audio meters with live levels. Held on
// the REAL `/session/live` route over a test simulator in the recording scenario (the state is put on
// the store as the Core sends it): while `captureDurable` is false each MIC card shows the connecting
// state in the meter's place — no meter, no level — and the first durable fragment brings the meters
// back. CONTROL: a session without the member draws the meters, as before.
//
// Import order matters: the gorhom mock, then the router harness.
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it } from '@jest/globals';
import { act, screen, within } from '@testing-library/react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { renderMonitorApp, settle, type MonitorHarness } from './testing/monitor-harness';
import { StyleSheet } from 'react-native';
import { typography } from '@dems/shared/tokens';
import { InterruptedSealNotice } from '@/features/session-finalizing/interrupted-seal';
import { createTestSim, flushAsync, renderWithRuntime } from '@/runtime/testing/test-sim';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { MONITOR_TIMER_SLOT_HEIGHT } from './session-live-screen';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('connecting meters', () => {
unmountBeforeTheHooksOfThisGroup();

afterEach(() => {
  resetMotionStateForTests();
  resetMissingKeys();
});

const setDurable = (h: MonitorHarness, captureDurable: boolean) => act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable } })));
const count = (testID: string): number => screen.queryAllByTestId(testID).length;
// D61 (2026-11-04): the audio slice names the CHANNEL code of each meter (`MIC-0N`), and all four
// channels of the plane draw a card and a meter — the loop runs over the codes, not 1..2.
const MIC_CHANNEL_CODES = ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const;

describe('the audio meters while the cameras connect (pass D7 item 4)', () => {
  for (const window of ['phonePortrait', 'tabletLandscape'] as const) {
    it(`${window}: no meter and no level before the first durable fragment; the connecting state in its place`, async () => {
      const h = renderMonitorApp({ window });
      await settle();
      h.openMonitor();
      expect(screen.getByTestId('screen-session-live')).toBeTruthy();
      // CONTROL: the session without the member draws both meters.
      for (const channel of MIC_CHANNEL_CODES) {
        expect(count(`monitor-meter-${channel}`)).toBeGreaterThan(0);
        expect(count(`monitor-meter-${channel}-connecting`)).toBe(0);
      }

      setDurable(h, false);
      for (const channel of MIC_CHANNEL_CODES) {
        expect(count(`monitor-meter-${channel}`)).toBe(0);
        const place = screen.getAllByTestId(`monitor-meter-${channel}-connecting`)[0]!;
        expect(within(place).getByText('CONNECTING')).toBeTruthy();
        expect(String(place.props.accessibilityLabel)).toMatch(/: Connecting cameras…$/);
        // The card itself stays (the microphone, its state chip): only the level is withheld.
        expect(count(`monitor-mic-${channel}`)).toBeGreaterThan(0);
        expect(within(screen.getAllByTestId(`monitor-mic-${channel}`)[0]!).queryByText(/dBFS/)).toBeNull();
      }

      setDurable(h, true);
      for (const channel of MIC_CHANNEL_CODES) {
        expect(count(`monitor-meter-${channel}`)).toBeGreaterThan(0);
        expect(count(`monitor-meter-${channel}-connecting`)).toBe(0);
      }
      expect(getMissingKeys()).toEqual([]);
    });
  }
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-k-m2-clock-slot.test.tsx` (test-suite consolidation, D233): every case as it was.
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
describe('clock slot, interrupted recording, fault row and picture format', () => {
unmountBeforeTheHooksOfThisGroup();
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

  // Task 4 row 55 / integration pass I-3 (P12-F08): a slice that states no rate reads its picture alone, never "1080p •  fps".
  it('the format chip of a camera slice that states no rate is its picture without a rate', async () => {
    const h = renderMonitorApp({ window: 'phonePortrait' });
    await settle();
    h.openMonitor();
    const chips = (): string[] => screen.queryAllByTestId('monitor-feed-format').map((chip) => within(chip).queryAllByText(/./).map((node) => String(node.props.children)).join('|'));
    // CONTROL: the rate the slice states is printed as stated.
    expect(chips().length).toBeGreaterThan(0);
    expect(new Set(chips())).toEqual(new Set(['1080p • 25 fps']));
    act(() => h.sim.store.setState((s) => ({ cameras: s.cameras.map((camera) => ({ ...camera, resolution: '1080p', fps: null, codec: 'HEVC' as const })) })));
    await settle();
    expect(chips().length).toBeGreaterThan(0);
    expect(new Set(chips())).toEqual(new Set(['1080p']));
    expect(screen.queryAllByText(/fps|•/)).toHaveLength(0);
    expect(getMissingKeys()).toEqual([]);
  });
});
});
