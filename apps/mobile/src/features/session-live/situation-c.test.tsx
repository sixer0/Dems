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
import { SESSION_CAPTURE_CHECKPOINTS_EXAMPLE } from '@dems/shared/api';
import { captureFaultSentence, type SimAlert, type SimState } from '@dems/shared/sim';
import { camerasNotConnectedOf, captureFaultLine, deviceLabel, failedStartClosingOf, failedStartOf } from '@/features/capture-selector/capture-notices-model';
import { getMissingKeys, resetMissingKeys, i18n } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import { RuntimeTestProviders, createTestSim } from '@/runtime/testing/test-sim';
import { CaptureStartNotice, FailedStartNotice } from './capture-start-notice';
import { statusStrip } from './session-live.math';
import { renderMonitorApp, settle, type MonitorHarness, type MonitorHarnessOptions } from './testing/monitor-harness';
import { I18nextProvider } from 'react-i18next';
import { CaptureCheckpoints } from './capture-checkpoints';
import { captureCheckpointsOf, checkpointAge, ownCaptureOf } from './own-capture';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('situation c', () => {
unmountBeforeTheHooksOfThisGroup();

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

  it('review R74-03: a capture fault is worded by its reason, from the shared source, with the device by the name of this app', () => {
    const t = (key: string, options?: Record<string, unknown>): string => (options === undefined ? key : `${key}${JSON.stringify(options)}`);
    const onDevice = (reason: string | null, target: string): SimAlert => ({ ...captureFault(reason), target, params: reason === null ? { kind: 'CAPTURE_FAULT' } : { kind: 'CAPTURE_FAULT', reason } });
    const mic = captureFaultLine(t, onDevice('MIC_DISCONNECTED', 'MIC-01')) ?? '';
    expect(mic).toBe(captureFaultSentence('MIC_DISCONNECTED', deviceLabel(t, 'MIC-01')));
    expect(mic).toMatch(/stopped delivering audio/);
    expect(captureFaultLine(t, onDevice('CAMERA_STREAM_ENDED', 'CAM-02'))).toMatch(/stopped delivering video/);
    // An unknown reason: the neutral sentence with its code; never the sentence of another cause.
    expect(captureFaultLine(t, onDevice('A_NEW_REASON', 'CAM-02'))).toMatch(/^Capture reported a problem on .*\(A_NEW_REASON\)\.$/);
    // The capture as a whole without a cause: an interrupted recording.
    expect(captureFaultLine(t, captureFault(null))).toMatch(/stopped unexpectedly/);
    // CONTROL: another kind of alert is not worded here.
    expect(captureFaultLine(t, { ...captureFault(null), kind: 'MIC_CLIP' })).toBeNull();
  });

  it('review R74-12: a failed start the Core is closing is RECOVERY with captureDurable false - and only that', () => {
    expect(failedStartClosingOf({ state: 'RECOVERY', captureDurable: false }, [captureFault('NO_CAMERA_CONNECTED')])).toBe('NO_CAMERA_CONNECTED');
    expect(failedStartClosingOf({ state: 'RECOVERY', captureDurable: false }, [])).toBe('OTHER');
    // CONTROLS: a durable recording being recovered, a session without the member, and the FAULT itself (that is `failedStartOf`).
    expect(failedStartClosingOf({ state: 'RECOVERY', captureDurable: true }, [captureFault('NO_CAMERA_CONNECTED')])).toBeNull();
    expect(failedStartClosingOf({ state: 'RECOVERY' }, [captureFault('NO_CAMERA_CONNECTED')])).toBeNull();
    expect(failedStartClosingOf({ state: 'FAULT', captureDurable: false }, [captureFault('NO_CAMERA_CONNECTED')])).toBeNull();
    expect(failedStartClosingOf(null, [])).toBeNull();
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

  // Fix wave Q (seen in the device proof on the tablet): after a resync of the Core link the session read "connecting"
  // for a moment - the OPEN End dialog was taken away with the reason typed so far, and its keyboard stayed over the
  // monitor with no field. `blocked` keeps the button from OPENING a dialog; it does not close one.
  it('an End dialog that is already open stays open, with its reason, while the session reads "connecting" for a moment', async () => {
    const h = await open();
    fireEvent.press(screen.getByTestId('monitor-end-session'));
    expect(screen.getByTestId('monitor-end-dialog')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('monitor-end-reason'), 'Interview complete');

    setDurable(h, false);
    expect(isDisabled('monitor-end-session')).toBe(true);
    expect(screen.getByTestId('monitor-end-dialog')).toBeTruthy();
    expect(screen.getByTestId('monitor-end-reason').props.value).toBe('Interview complete');

    setDurable(h, true);
    expect(screen.getByTestId('monitor-end-dialog')).toBeTruthy();
    expect(screen.getByTestId('monitor-end-reason').props.value).toBe('Interview complete');
    expect(h.sim.store.getState().session?.state).toBe('RECORDING');
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
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-h-z2-own-capture.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave H, closing pass Z2 (driver A's request line of 10:20:55Z, item 3; decisions D203, D207;
// closing pass Z1's line of 10:30:00Z for the member names). Session Live beside a Core in its own
// capture:
//
// | Rule | Case |
// |------|------|
// | The TIME chip words the time source AS THE CORE STATES IT: a slice that says the host clock (`hostClock: true`, `isHostClockTime`) reads "Host system clock" - no "GNSS", no "LOCKED", no warning tone for a clock that is not a fallback | "TIME chip" |
// | The capture checkpoint facts (`session.captureCheckpoints`) are drawn when the Core states them; absent = nothing, never 0; never beside a session of the simulator's own capture | "checkpoints" |
//
// CONTROLS: the simulator's own time slice keeps "TIME GNSS LOCKED"; the simulated recording draws no checkpoint line.
//
// Import order matters: the gorhom mock, then the router harness.
describe('a Core in its own capture: the time chip and the checkpoints', () => {
unmountBeforeTheHooksOfThisGroup();
afterEach(() => {
  resetMotionStateForTests();
  expect(getMissingKeys()).toEqual([]);
  resetMissingKeys();
});

const HOST_CLOCK = { hostClock: true, source: 'RTC', locked: false, stratum: 0, offsetMs: 0, lastSyncAt: 0, gnss: { locked: false, satellites: 0 }, ntp: { server: '', reachable: false, stratum: 0 }, rtc: { driftPpm: 0 }, history: [] };
/** The chip's words: its label prop and every text below it. */
const textOf = (testID: string): string => screen.getAllByTestId(testID).map((node) => `${String(node.props.label ?? '')} ${String(node.props.accessibilityLabel ?? '')} ${allText(node)}`).join(' ');
function allText(node: { children?: unknown[]; props?: Record<string, unknown> }): string {
  return (node.children ?? []).map((child) => (typeof child === 'string' ? child : allText(child as { children?: unknown[] }))).join(' ');
}
const setSession = (h: MonitorHarness, patch: Record<string, unknown>) =>
  act(() => {
    const session = h.sim.store.getState().session!;
    h.sim.store.setState({ session: { ...session, ...patch } as typeof session });
  });

describe('TIME chip: the time source as the Core states it', () => {
  it('a Core whose time is the host system clock: "TIME Host system clock" - no GNSS, no LOCKED', async () => {
    const h = renderMonitorApp({ window: 'tabletLandscape' });
    await settle();
    h.openMonitor();
    // CONTROL: the simulator's own slice.
    expect(textOf('monitor-strip-time')).toContain('TIME GNSS LOCKED');

    act(() => h.sim.store.setState({ time: HOST_CLOCK as never }));
    await settle();
    const text = textOf('monitor-strip-time');
    expect(text).toContain('TIME Host system clock');
    expect(text).not.toContain('GNSS');
    expect(text).not.toContain('LOCKED');
    expect(text).not.toContain('RTC');
  });

  it('the rule (pure): the host clock is no fallback - an info chip that is not "locked"; an RTC fallback of the simulation stays a warning', () => {
    const base = { cameras: [], storage: 'READY' as const };
    expect(statusStrip({ ...base, timeSource: 'RTC', timeLocked: false, hostClock: true }).at(-1)).toEqual({ kind: 'time', id: 'time', value: 'RTC', locked: false, host: true, tone: 'info' });
    // Stated locked by mistake: the host clock is never drawn as locked.
    expect(statusStrip({ ...base, timeSource: 'RTC', timeLocked: true, hostClock: true }).at(-1)).toMatchObject({ locked: false, host: true });
    expect(statusStrip({ ...base, timeSource: 'RTC', timeLocked: false }).at(-1)).toEqual({ kind: 'time', id: 'time', value: 'RTC', locked: false, host: false, tone: 'warning' });
    expect(statusStrip({ ...base, timeSource: 'GNSS', timeLocked: true }).at(-1)).toEqual({ kind: 'time', id: 'time', value: 'GNSS', locked: true, host: false, tone: 'success' });
  });
});

describe('checkpoints: what the Core states of its durable fragments', () => {
  // V98-09 (batch N): the payload is the CONTRACT'S example, not an object built here (rule of D208).
  const CHECKPOINTS = { ...SESSION_CAPTURE_CHECKPOINTS_EXAMPLE, cameras: [...SESSION_CAPTURE_CHECKPOINTS_EXAMPLE.cameras] };

  it('Session Live: drawn from the session member in real capture; absent = nothing drawn; never beside the simulator\'s own recording', async () => {
    const h = renderMonitorApp({ window: 'tabletLandscape' });
    await settle();
    h.openMonitor();
    const lastAt = Math.floor(h.sim.store.getState().clock.now / 1000) * 1000 - 2_000;
    // CONTROL: a session without the capture member draws none, whatever else it carries.
    setSession(h, { captureCheckpoints: { ...CHECKPOINTS, lastAt } });
    await settle();
    expect(screen.queryByTestId('monitor-capture-checkpoints')).toBeNull();

    setSession(h, { captureDurable: true, captureCheckpoints: undefined });
    await settle();
    // ABSENT: nothing - never a zero.
    expect(screen.queryByTestId('monitor-capture-checkpoints')).toBeNull();

    setSession(h, { captureDurable: true, captureCheckpoints: { ...CHECKPOINTS, lastAt } });
    await settle();
    const line = screen.getAllByTestId('monitor-capture-checkpoints-total')[0]!;
    expect(allText(line)).toBe('24 fragments saved · last 2 s ago · 34.0 MB');
    expect(screen.getAllByTestId('monitor-capture-checkpoints-camera-CAM-01').length).toBeGreaterThan(0);
    expect(allText(screen.getAllByTestId('monitor-capture-checkpoints-camera-CAM-01')[0]!)).toBe('Camera 1 (CAM-01) · 12 fragments saved · 20.0 MB');
  });

  it('the component from literal props (no store): totals, one line per camera, minutes from two minutes on', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <CaptureCheckpoints facts={{ fragments: 1, bytes: 1_500_000_000, lastAt: 0, cameras: [{ deviceId: 'CAM-03', fragments: 1, bytes: 1_500_000_000 }] }} nowMs={180_000} />
      </I18nextProvider>,
    );
    expect(allText(screen.getByTestId('monitor-capture-checkpoints-total'))).toBe('1 fragment saved · last 3 min ago · 1.5 GB');
    expect(screen.getByTestId('monitor-capture-checkpoints-camera-CAM-03')).toBeTruthy();
  });

  it('the readers (pure)', () => {
    expect(ownCaptureOf(null)).toBe(false);
    expect(ownCaptureOf({ state: 'RECORDING' })).toBe(false);
    expect(ownCaptureOf({ state: 'RECORDING', captureDurable: false })).toBe(true);
    expect(ownCaptureOf({ state: 'SEALED', captureDurable: true })).toBe(true);
    expect(captureCheckpointsOf(null)).toBeNull();
    expect(captureCheckpointsOf({})).toBeNull();
    expect(captureCheckpointsOf({ captureCheckpoints: { fragments: 0, bytes: 0, lastAt: 1, cameras: [] } })).toBeNull();
    expect(captureCheckpointsOf({ captureCheckpoints: { fragments: '3', bytes: 1, lastAt: 1, cameras: [] } })).toBeNull();
    expect(captureCheckpointsOf({ captureCheckpoints: { fragments: 3, bytes: 10, lastAt: 5, cameras: [{ deviceId: 'CAM-01', fragments: 3, bytes: 10 }, { deviceId: 7 }] } })).toEqual({ fragments: 3, bytes: 10, lastAt: 5, cameras: [{ deviceId: 'CAM-01', fragments: 3, bytes: 10 }] });
    expect(checkpointAge(10_000, 8_000)).toEqual({ unit: 'lastSeconds', seconds: 2 });
    expect(checkpointAge(8_000, 10_000)).toEqual({ unit: 'lastSeconds', seconds: 0 });
    expect(checkpointAge(200_000, 0)).toEqual({ unit: 'lastMinutes', minutes: 3 });
  });
});
});
