// Task 3, blueprint row 139 (NEW SCOPE R-10): the session start with cameras not connected, on the
// tablet and the phone (Session Live MB-03; masterplan/08_client_ux_spec.md §8e flow 11 situation C,
// §8 step 5; masterplan/03_api_contract.md §3.1, §5.4; decisions D72(k), D84, D91 R-1 option A).
// Checks M5-NODEV-C-T / -P, client half, on the REAL `/session/live` route over a test simulator in
// the recording scenario. The simulator never writes `captureDurable`, so each state is put on the
// store as the Core would send it.
//
// What is held: before the first durable fragment nothing reads as recording (no REC, no timer, no
// "VIDEO n REC") and End Session is disabled WITH its reason; one camera of two is a warning naming
// the missing camera, whose rows read offline / NO SIGNAL while the timer runs; a failed start is
// read from the session (`FAULT` + `captureDurable: false`) and says "Nothing was recorded." in full.
//
// Import order matters: the gorhom mock, then the router harness.
import './testing/monitor-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import type { SimAlert, SimState } from '@dems/shared/sim';
import { camerasNotConnectedOf, failedStartOf } from '@/features/capture-selector/capture-notices-model';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { RuntimeTestProviders, createTestSim } from '@/runtime/testing/test-sim';
import { CaptureStartNotice, FailedStartNotice } from './capture-start-notice';
import { statusStrip } from './session-live.math';
import { renderMonitorApp, settle, type MonitorHarness, type MonitorHarnessOptions } from './testing/monitor-harness';

afterEach(() => {
  resetMotionStateForTests();
  resetMissingKeys();
});

const STOP_REASON = 'Nothing is recorded yet: the cameras are still connecting. The session ends by itself if no camera connects.';

async function open(options: MonitorHarnessOptions = {}): Promise<MonitorHarness> {
  const h = renderMonitorApp({ window: 'phonePortrait', ...options });
  await settle();
  h.openMonitor();
  expect(screen.getByTestId('screen-session-live')).toBeTruthy();
  return h;
}

const setDurable = (h: MonitorHarness, captureDurable: boolean) => act(() => h.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable } })));
const isDisabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;

/** The degraded warning of a session start, as the Core's notifier writes it. */
const notConnected = (deviceId: string, patch: Partial<SimAlert> = {}): SimAlert => ({
  id: 'ALR-000902',
  at: 0,
  severity: 'WARNING',
  kind: 'SYSTEM',
  message: `${deviceId} is not connected`,
  active: true,
  acknowledged: false,
  resolvedAt: null,
  target: deviceId,
  params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId, deviceKind: 'CAMERA', phase: 'SESSION_START', cause: 'NOT_CONNECTED' },
  ...patch,
});

const captureFault = (reason: string | null): SimAlert => ({
  id: 'ALR-000901',
  at: 0,
  severity: 'CRITICAL',
  kind: 'CAPTURE_FAULT',
  message: 'Capture fault',
  active: true,
  acknowledged: false,
  resolvedAt: null,
  target: null,
  params: reason === null ? { kind: 'CAPTURE_FAULT' } : { kind: 'CAPTURE_FAULT', reason, evidenceFiles: 0 },
});

describe('the rules (pure)', () => {
  it('a failed start is FAULT with an explicit `captureDurable: false`; "no camera" only when the Core says so', () => {
    expect(failedStartOf({ state: 'FAULT', captureDurable: false }, [captureFault('NO_CAMERA_CONNECTED')])).toBe('NO_CAMERA_CONNECTED');
    expect(failedStartOf({ state: 'FAULT', captureDurable: false }, [captureFault(null)])).toBe('OTHER');
    expect(failedStartOf({ state: 'FAULT', captureDurable: false }, [{ ...captureFault('NO_CAMERA_CONNECTED'), active: false }])).toBe('OTHER');
    // CONTROLS: an interrupted recording, a session without the member (the simulator), another state, no session.
    expect(failedStartOf({ state: 'FAULT', captureDurable: true }, [captureFault('NO_CAMERA_CONNECTED')])).toBeNull();
    expect(failedStartOf({ state: 'FAULT' }, [captureFault('NO_CAMERA_CONNECTED')])).toBeNull();
    expect(failedStartOf({ state: 'RECORDING', captureDurable: false }, [captureFault('NO_CAMERA_CONNECTED')])).toBeNull();
    expect(failedStartOf(null, [])).toBeNull();
  });

  it('the cameras a session start names: active SESSION_START notices of cameras only', () => {
    expect(camerasNotConnectedOf([notConnected('CAM-02')]).map((notice) => notice.deviceId)).toEqual(['CAM-02']);
    expect(camerasNotConnectedOf([notConnected('CAM-02', { active: false })])).toEqual([]);
    expect(camerasNotConnectedOf([notConnected('CAM-02', { params: { ...notConnected('CAM-02').params, phase: 'PRECHECK' } })])).toEqual([]);
    expect(camerasNotConnectedOf([notConnected('MIC-02', { params: { ...notConnected('MIC-02').params, deviceKind: 'MIC' } })])).toEqual([]);
  });

  it('the status strip: no camera reads REC while connecting; a camera the start named reads OFFLINE even when its track says REC', () => {
    const cameras = [
      { index: 1 as const, online: true, recState: 'REC' as const },
      { index: 2 as const, online: true, recState: 'REC' as const },
    ];
    const base = { cameras, storage: 'READY' as const, timeSource: 'GNSS' as const, timeLocked: true };
    // CONTROL: a durable recording reads REC.
    expect(statusStrip(base).slice(0, 2).map((chip) => [chip.value, chip.tone])).toEqual([['REC', 'success'], ['REC', 'success']]);
    expect(statusStrip({ ...base, connecting: true }).slice(0, 2).map((chip) => [chip.value, chip.tone])).toEqual([['CONNECTING', 'info'], ['CONNECTING', 'info']]);
    const degraded = statusStrip({ ...base, cameras: [cameras[0]!, { ...cameras[1]!, notConnected: true }] });
    expect(degraded.slice(0, 2).map((chip) => [chip.value, chip.tone])).toEqual([['REC', 'success'], ['OFFLINE', 'danger']]);
  });
});

describe('connecting cameras: between the accepted start and the first durable fragment (D84)', () => {
  it('nothing reads as recording and End Session is disabled with its reason; the first durable fragment brings both back', async () => {
    const h = await open();
    const root = () => within(screen.getByTestId('screen-session-live'));
    // CONTROL: the simulator's recording is durable - the reads below are present before and after.
    expect(within(screen.getByTestId('monitor-feed-rec')).getByText('REC')).toBeTruthy();
    expect(root().getByText('VIDEO 1 REC')).toBeTruthy();
    expect(isDisabled('monitor-end-session')).toBe(false);
    expect(screen.queryByTestId('monitor-end-session-blocked')).toBeNull();

    setDurable(h, false);
    // No recording indicator on the feed, no timer, no "VIDEO n REC".
    const feedChip = within(screen.getByTestId('monitor-feed-rec'));
    expect(feedChip.queryByText('REC')).toBeNull();
    expect(feedChip.getByText('CONNECTING')).toBeTruthy();
    expect(screen.queryByTestId('monitor-feed-timer')).toBeNull();
    expect(screen.queryByTestId('monitor-timer')).toBeNull();
    expect(root().queryByText('VIDEO 1 REC')).toBeNull();
    expect(root().queryByText('VIDEO 2 REC')).toBeNull();
    expect(root().getByText('VIDEO 1 CONNECTING')).toBeTruthy();
    expect(root().queryByText('Recording')).toBeNull();

    // End Session: disabled, and it says why - under the control and as its hint.
    expect(isDisabled('monitor-end-session')).toBe(true);
    expect(within(screen.getByTestId('monitor-end-session-blocked')).getByText(STOP_REASON)).toBeTruthy();
    expect(screen.getByTestId('monitor-end-session').props.accessibilityHint).toBe(STOP_REASON);
    // A press ends nothing and opens no dialog.
    fireEvent.press(screen.getByTestId('monitor-end-session'));
    fireEvent(screen.getByTestId('monitor-end-session'), 'longPress');
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
    expect(screen.queryByText('End session?')).toBeNull();

    setDurable(h, true);
    expect(within(screen.getByTestId('monitor-feed-rec')).getByText('REC')).toBeTruthy();
    expect(root().getByText('VIDEO 1 REC')).toBeTruthy();
    expect(isDisabled('monitor-end-session')).toBe(false);
    expect(screen.queryByTestId('monitor-end-session-blocked')).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });
});

describe('one camera of two: a degraded session (WARNING)', () => {
  it('a banner names the missing camera by label and id; its strip row reads offline; the recording runs; cleared by the Core only', async () => {
    const h = await open();
    expect(screen.queryByTestId('monitor-camera-not-connected')).toBeNull();
    act(() => h.sim.store.setState((s) => ({ alerts: [...s.alerts, notConnected('CAM-02')] })));

    const banner = within(screen.getByTestId('monitor-camera-not-connected-CAM-02'));
    expect(banner.getByText('Camera 2 (CAM-02) is not connected')).toBeTruthy();
    expect(banner.getByText('The session is recording one camera only. It did not connect in time.')).toBeTruthy();
    const root = within(screen.getByTestId('screen-session-live'));
    expect(root.getByText('VIDEO 1 REC')).toBeTruthy();
    expect(root.queryByText('VIDEO 2 REC')).toBeNull();
    // The recording timer runs and End Session works as usual.
    expect(screen.getByTestId('monitor-timer')).toBeTruthy();
    expect(isDisabled('monitor-end-session')).toBe(false);

    act(() => h.sim.store.setState((s: SimState) => ({ alerts: s.alerts.map((alert) => (alert.id === 'ALR-000902' ? { ...alert, active: false, resolvedAt: 1 } : alert)) })));
    expect(screen.queryByTestId('monitor-camera-not-connected')).toBeNull();
    expect(within(screen.getByTestId('screen-session-live')).getByText('VIDEO 2 REC')).toBeTruthy();
    expect(getMissingKeys()).toEqual([]);
  });

  it('drawn alone: nothing without a session-start notice (a pre-check notice is not one)', () => {
    const test = createTestSim({ scenario: 'recording' });
    test.sim.store.setState((s) => ({ alerts: [...s.alerts, notConnected('CAM-02', { params: { ...notConnected('CAM-02').params, phase: 'PRECHECK' } })] }));
    render(
      <RuntimeTestProviders sim={test.sim}>
        <CaptureStartNotice />
      </RuntimeTestProviders>,
    );
    expect(screen.queryByTestId('monitor-camera-not-connected')).toBeNull();
  });
});

describe('a failed start: no camera connected (situation C, CRITICAL)', () => {
  const failed = (reason: string | null, captureDurable = false) => {
    const test = createTestSim({ scenario: 'recording' });
    test.sim.store.setState((s) => ({
      session: { ...s.session!, state: 'FAULT', fault: { kind: 'CAPTURE_FAULT', at: s.clock.now, fromState: 'RECORDING' }, startedAt: captureDurable ? s.session!.startedAt : null, bytesWritten: 0, captureDurable },
      alerts: [...s.alerts, captureFault(reason)],
    }));
    return test;
  };

  it('"No camera connected" / "Nothing was recorded." in full, announced assertively, with the pointer to Devices', () => {
    const onOpenDevices = jest.fn();
    render(
      <RuntimeTestProviders sim={failed('NO_CAMERA_CONNECTED').sim}>
        <FailedStartNotice onOpenDevices={onOpenDevices} />
      </RuntimeTestProviders>,
    );
    expect(screen.getByTestId('session-failed-start').props.accessibilityLiveRegion).toBe('assertive');
    const notice = within(screen.getByTestId('session-failed-start-NO_CAMERA_CONNECTED'));
    expect(notice.getByText('No camera connected')).toBeTruthy();
    expect(notice.getByText('Nothing was recorded. Check the cameras on Devices, then close this session and start a new one.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('session-failed-start-devices'));
    expect(onOpenDevices).toHaveBeenCalledTimes(1);
    expect(getMissingKeys()).toEqual([]);
  });

  it('a failed start with no camera reason still says that nothing was recorded; without a handler no pointer is drawn', () => {
    render(
      <RuntimeTestProviders sim={failed(null).sim}>
        <FailedStartNotice />
      </RuntimeTestProviders>,
    );
    const notice = within(screen.getByTestId('session-failed-start-OTHER'));
    expect(notice.getByText('Recording did not start')).toBeTruthy();
    expect(notice.queryByText('No camera connected')).toBeNull();
    expect(screen.queryByTestId('session-failed-start-devices')).toBeNull();
  });

  it('CONTROL: an interrupted recording (durable) and a recording session draw nothing', () => {
    const view = render(
      <RuntimeTestProviders sim={failed('NO_CAMERA_CONNECTED', true).sim}>
        <FailedStartNotice />
      </RuntimeTestProviders>,
    );
    expect(screen.queryByTestId('session-failed-start')).toBeNull();
    view.unmount();
    render(
      <RuntimeTestProviders sim={createTestSim({ scenario: 'recording' }).sim}>
        <FailedStartNotice />
      </RuntimeTestProviders>,
    );
    expect(screen.queryByTestId('session-failed-start')).toBeNull();
  });
});
