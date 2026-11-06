// T-M08 (04_mobile_specs §10.1, §3.6; MA-09 unit form): on the Session Monitor during RECORDING,
// Back opens the "Leave the monitor?" Dialog and the session stays RECORDING; Stay keeps the
// monitor; Go to Home leaves for /home and the recording continues. Back never stops a recording.
// The harness import comes first (see its header).
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { BackHandler } from 'react-native';
import { resetMotionStateForTests } from '@/motion';
import { renderMonitorApp, settle } from './testing/monitor-harness';

afterEach(() => {
  resetMotionStateForTests();
  jest.restoreAllMocks();
});

/** Captures the screen's hardware-Back listeners (Android's BackHandler) so a test can press Back. */
type BackListener = Parameters<typeof BackHandler.addEventListener>[1];

function spyHardwareBack() {
  const listeners: BackListener[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    listeners.push(handler);
    return { remove: () => void listeners.splice(listeners.indexOf(handler), 1) };
  });
  /** Presses Back: the newest listener first, as BackHandler does; true = consumed. */
  return () => {
    let consumed = false;
    act(() => {
      for (const listener of [...listeners].reverse()) {
        if (listener({} as Parameters<BackListener>[0])) {
          consumed = true;
          break;
        }
      }
    });
    return consumed;
  };
}

const PROMPT = 'Recording continues on the Core. Leave the monitor?';

describe('T-M08 Session Monitor back guard (MA-09)', () => {
  it('opens on RECORDING with the session timer from the simulator clock', async () => {
    const h = renderMonitorApp();
    await settle();
    h.openMonitor();
    expect(h.app.getPathname()).toBe('/session/live');
    expect(screen.getByTestId('screen-session-live')).toBeTruthy();
    // Scenario 0024 loads 00:18:42 into the recording (D61); the timer reads the simulator clock.
    expect(screen.getAllByLabelText('00:18:42').length).toBeGreaterThan(0);
    expect(screen.queryByText(PROMPT)).toBeNull();
  });

  it('Back during RECORDING opens the Dialog and keeps the session RECORDING; Stay keeps the monitor', async () => {
    const h = renderMonitorApp();
    await settle();
    h.openMonitor();

    act(() => router.back());
    expect(h.app.getPathname()).toBe('/session/live');
    expect(screen.getByText(PROMPT)).toBeTruthy();
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');

    fireEvent.press(screen.getByTestId('back-guard-stay'));
    expect(screen.queryByText(PROMPT)).toBeNull();
    expect(h.app.getPathname()).toBe('/session/live');
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
  });

  it('the header arrow is guarded the same way', async () => {
    const h = renderMonitorApp();
    await settle();
    h.openMonitor();
    fireEvent.press(screen.getByTestId('monitor-back'));
    expect(screen.getByText(PROMPT)).toBeTruthy();
    expect(h.app.getPathname()).toBe('/session/live');
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
  });

  it('"Go to Home" leaves for /home and the recording continues (no stop, no audit stop row)', async () => {
    const h = renderMonitorApp();
    await settle();
    h.openMonitor();
    const auditBefore = h.sim.store.getState().audit.rows.filter((row) => row.type === 'RECORDING_STOPPED').length;

    act(() => router.back());
    act(() => {
      fireEvent.press(screen.getByTestId('back-guard-leave'));
    });

    expect(h.app.getPathname()).toBe('/home');
    const state = h.sim.store.getState();
    expect(state.session?.state).toBe('RECORDING');
    expect(state.session?.stopReason).toBeNull();
    expect(state.audit.rows.filter((row) => row.type === 'RECORDING_STOPPED').length).toBe(auditBefore);

    // Time keeps running while away: the recording is untouched by leaving the monitor.
    act(() => h.advance(5_000));
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
  });

  it('several Back presses never stop the recording', async () => {
    const h = renderMonitorApp();
    await settle();
    h.openMonitor();
    for (let i = 0; i < 3; i += 1) {
      act(() => router.back());
      expect(screen.getByText(PROMPT)).toBeTruthy();
      fireEvent.press(screen.getByTestId('back-guard-stay'));
    }
    expect(h.app.getPathname()).toBe('/session/live');
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
  });

  it('once the recording has ended, the guard is off and the route follows the session (STOPPING → finalizing)', async () => {
    const h = renderMonitorApp();
    await settle();
    h.openMonitor();
    act(() => h.sim.actions.stopRecording('Interview finished'));
    expect(h.sim.store.getState().session?.state).toBe('STOPPING');
    expect(h.app.getPathname()).toBe('/session/finalizing');
    expect(screen.queryByText(PROMPT)).toBeNull();
  });

  it('hardware Back with a route below: the monitor passes it on, the stack pops and the guard asks', async () => {
    const pressBack = spyHardwareBack();
    const h = renderMonitorApp();
    await settle();
    h.openMonitor();
    // The monitor's listener declines (a route is below); React Navigation's own listener pops the
    // stack and usePreventRemove holds it.
    expect(pressBack()).toBe(true);
    expect(h.app.getPathname()).toBe('/session/live');
    expect(screen.getByText(PROMPT)).toBeTruthy();
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
  });

  it('F-79-1: hardware Back with NO route below (monitor opened by the resync) still asks instead of leaving the app', async () => {
    const pressBack = spyHardwareBack();
    const h = renderMonitorApp({ initialUrl: '/session/live' });
    await settle();
    expect(h.app.getPathname()).toBe('/session/live');
    expect(router.canGoBack()).toBe(false);

    expect(pressBack()).toBe(true); // consumed: Android never falls through to the OS
    expect(screen.getByText(PROMPT)).toBeTruthy();
    expect(pressBack()).toBe(true); // Back again = Stay
    expect(screen.queryByText(PROMPT)).toBeNull();

    fireEvent.press(screen.getByTestId('monitor-back')); // the header arrow asks the same way
    expect(screen.getByText(PROMPT)).toBeTruthy();
    act(() => {
      fireEvent.press(screen.getByTestId('back-guard-leave'));
    });
    expect(h.app.getPathname()).toBe('/home');
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
  });
});
