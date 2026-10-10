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

afterEach(() => {
  resetMotionStateForTests();
  resetMissingKeys();
});

const setDurable = (h: MonitorHarness, captureDurable: boolean) => act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable } })));
const count = (testID: string): number => screen.queryAllByTestId(testID).length;

describe('the audio meters while the cameras connect (pass D7 item 4)', () => {
  for (const window of ['phonePortrait', 'tabletLandscape'] as const) {
    it(`${window}: no meter and no level before the first durable fragment; the connecting state in its place`, async () => {
      const h = renderMonitorApp({ window });
      await settle();
      h.openMonitor();
      expect(screen.getByTestId('screen-session-live')).toBeTruthy();
      // CONTROL: the session without the member draws both meters.
      for (const channel of [1, 2]) {
        expect(count(`monitor-meter-${channel}`)).toBeGreaterThan(0);
        expect(count(`monitor-meter-${channel}-connecting`)).toBe(0);
      }

      setDurable(h, false);
      for (const channel of [1, 2]) {
        expect(count(`monitor-meter-${channel}`)).toBe(0);
        const place = screen.getAllByTestId(`monitor-meter-${channel}-connecting`)[0]!;
        expect(within(place).getByText('CONNECTING')).toBeTruthy();
        expect(String(place.props.accessibilityLabel)).toMatch(/: Connecting cameras…$/);
        // The card itself stays (the microphone, its state chip): only the level is withheld.
        expect(count(`monitor-mic-${channel}`)).toBeGreaterThan(0);
        expect(within(screen.getAllByTestId(`monitor-mic-${channel}`)[0]!).queryByText(/dBFS/)).toBeNull();
      }

      setDurable(h, true);
      for (const channel of [1, 2]) {
        expect(count(`monitor-meter-${channel}`)).toBeGreaterThan(0);
        expect(count(`monitor-meter-${channel}-connecting`)).toBe(0);
      }
      expect(getMissingKeys()).toEqual([]);
    });
  }
});
