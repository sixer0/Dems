// Task 3, integration pass D7 item 3, mobile (row 139's request, file_requests.md 16:42:26Z;
// masterplan/08_client_ux_spec.md §8e.1 "told apart by reason", §8e.2 situation C and "Between the
// accepted start and the first durable fragment"; decisions D84, D91 R-1 option A, D156).
//
// Three placement groups of the phone / tablet shell, one case each, over a test simulator in the
// recording scenario (it never writes `captureDurable`, so the state is put on the store as the Core
// sends it):
// - Home tiles (System Status card): "Connecting cameras…" — no REC chip, no timer — while
//   `captureDurable` is false; a failed start says "Nothing was recorded." in full;
// - bottom bar (the Recording bar of the tabs): "Connecting cameras…", no REC dot, no timer;
// - Home header bell: the alert of a failed start is worded from `params.reason`, the degraded
//   warning names the camera.
// Each case holds its CONTROL: a session without the member, and a durable one, read as recording.
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, cleanup, fireEvent, screen } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { DEMO_OPERATOR_PASSWORD, type SimAlert } from '@dems/shared/sim';
import { LiveMiniBar } from '@/components/composed/nav/live-mini-bar';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreLinkPrefsForTests, useActiveSession } from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';
import { DashboardScreen } from './dashboard-screen';
import { failedStartAlertLabel } from './home-model';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
  useIsFocused: () => true,
}));

/** Home with the bar over it, as the phone draws them while a session is RECORDING (the bar is the tabs' chrome). */
function HomeWithBar() {
  const session = useActiveSession();
  return (
    <>
      <DashboardScreen />
      {session.state === 'RECORDING' ? <LiveMiniBar session={session} placement="above-bar" /> : null}
    </>
  );
}

const textOf = (testID: string): string => {
  const parts: string[] = [];
  const walk = (n: ReactTestInstance | string) => {
    if (typeof n === 'string') parts.push(n);
    else n.children.forEach(walk);
  };
  walk(screen.getAllByTestId(testID)[0]!);
  return parts.join('');
};
const has = (testID: string): boolean => screen.queryAllByTestId(testID).length > 0;

/** The kit's Popover opens only after measuring its trigger (as `dashboard-screen.test.tsx`). */
function stubMeasure(testID: string) {
  let node: ReactTestInstance | null = screen.getByTestId(testID);
  let stubbed = 0;
  while (node) {
    const instance = node.instance as { measure?: jest.Mock } | null;
    if (instance && typeof instance.measure === 'function' && 'mockImplementation' in instance.measure) {
      instance.measure.mockImplementation((...args: unknown[]) => {
        (args[0] as (x: number, y: number, w: number, h: number, px: number, py: number) => void)(0, 0, 48, 48, 300, 40);
      });
      stubbed += 1;
    }
    node = node.parent;
  }
  expect(stubbed).toBeGreaterThan(0);
}

const alertOf = (patch: Partial<SimAlert>): SimAlert => ({
  id: 'ALR-000900',
  at: 0,
  severity: 'CRITICAL',
  kind: 'CAPTURE_FAULT',
  message: 'Capture fault',
  active: true,
  acknowledged: false,
  resolvedAt: null,
  target: null,
  params: { kind: 'CAPTURE_FAULT' },
  ...patch,
});
const noCamera = alertOf({ id: 'ALR-000901', params: { kind: 'CAPTURE_FAULT', reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 } });
const plainFault = alertOf({ id: 'ALR-000903' });
const cameraNotConnected = alertOf({
  id: 'ALR-000902',
  severity: 'WARNING',
  kind: 'SYSTEM',
  message: 'CAM-02 is not connected',
  target: 'CAM-02',
  params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'SESSION_START', cause: 'NOT_CONNECTED' },
});

const setDurable = (test: TestSim, captureDurable: boolean) => act(() => test.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable } })));

async function mount(): Promise<TestSim> {
  const test = createTestSim({ scenario: 'recording' });
  expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  expect(test.sim.store.getState().session?.state).toBe('RECORDING');
  renderWithRuntime(<HomeWithBar />, { sim: test.sim });
  await flushAsync();
  return test;
}

beforeAll(async () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  await new Promise((resolve) => setTimeout(resolve, 50));
});

beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetMotionStateForTests();
  resetLoopRegistryForTests();
  resetMissingKeys();
});

afterEach(() => {
  cleanup();
});

describe('session start on the mobile shell (pass D7 item 3)', () => {
  it('Home tiles: "Connecting cameras…" with no REC chip and no timer while captureDurable is false; a failed start says "Nothing was recorded."', async () => {
    const test = await mount();
    // CONTROL: the session without the member reads as recording.
    expect(textOf('home-status-title')).toBe('Session in progress');
    expect(textOf('home-status-subtitle')).toMatch(/^Recording SES-/);
    expect(has('home-status-rec')).toBe(true);
    expect(has('home-status-timer')).toBe(true);

    setDurable(test, false);
    expect(textOf('home-status-title')).toBe('Connecting cameras…');
    expect(textOf('home-status-subtitle')).toBe(test.sim.store.getState().session!.id);
    expect(has('home-status-rec')).toBe(false);
    expect(has('home-status-timer')).toBe(false);
    expect(String(screen.getAllByTestId('home-status-ring')[0]!.props.accessibilityLabel)).toBe('System status: CONNECTING');
    expect(screen.queryByText(/^Recording /)).toBeNull();

    // The first durable fragment: recording again.
    setDurable(test, true);
    expect(textOf('home-status-title')).toBe('Session in progress');
    expect(has('home-status-rec')).toBe(true);
    expect(has('home-status-timer')).toBe(true);

    // A failed start: FAULT with captureDurable false, the Core's alert naming the cause.
    act(() => test.sim.actions.inject('POWER_FAIL'));
    await flushAsync();
    expect(test.sim.store.getState().session?.state).toBe('FAULT');
    // CONTROL: an interrupted (durable) recording keeps the fault's own subtitle.
    expect(textOf('home-status-subtitle')).toBe('A critical fault needs action');
    // Follow-up D158 item 4: the quick action of an interrupted recording is the recovery.
    expect(String(screen.getAllByTestId('home-action-primary')[0]!.props.accessibilityLabel)).toBe('Open recovery');
    act(() => test.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable: false }, alerts: [...s.alerts, noCamera] })));
    expect(textOf('home-status-subtitle')).toBe('No camera connected. Nothing was recorded.');
    // ... and of a session that recorded nothing: "View details" (nothing to recover).
    expect(String(screen.getAllByTestId('home-action-primary')[0]!.props.accessibilityLabel)).toBe('View details');
    expect(screen.queryByText('Open recovery')).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });

  it('bottom bar: "Connecting cameras…" with no REC dot and no timer while captureDurable is false', async () => {
    const test = await mount();
    // CONTROL: without the member the bar is the Recording bar.
    expect(textOf('nav-mini-bar-label')).toBe('Recording');
    expect(has('nav-mini-bar-rec')).toBe(true);
    expect(has('nav-mini-bar-timer')).toBe(true);

    setDurable(test, false);
    expect(textOf('nav-mini-bar-label')).toBe('Connecting cameras…');
    expect(has('nav-mini-bar-rec')).toBe(false);
    expect(has('nav-mini-bar-timer')).toBe(false);
    expect(String(screen.getByTestId('nav-mini-bar').props.accessibilityLabel)).toBe(`Connecting cameras… ${test.sim.store.getState().session!.id}`);

    setDurable(test, true);
    expect(textOf('nav-mini-bar-label')).toBe('Recording');
    expect(has('nav-mini-bar-rec')).toBe(true);
    expect(has('nav-mini-bar-timer')).toBe(true);
    expect(getMissingKeys()).toEqual([]);
  });

  it('Home header bell: the failed start is worded from params.reason, the degraded warning names the camera', async () => {
    const test = await mount();
    act(() => test.sim.store.setState((s) => ({ alerts: [...s.alerts, plainFault, cameraNotConnected, noCamera] })));
    stubMeasure('home-bell');
    fireEvent.press(screen.getByTestId('home-bell'));
    expect(textOf('home-alert-ALR-000901')).toContain('No camera connected. Nothing was recorded.');
    expect(textOf('home-alert-ALR-000902')).toContain('Camera 2 (CAM-02) is not connected');
    // CONTROL: a capture fault that names no cause, on a session that is not a failed start, is NOT worded as a failed start.
    // Fix pass F-M5 (review R74-03, D179 (b)): it reads as the interrupted recording it is - the shared sentence - where it read the bare label "Capture fault".
    expect(textOf('home-alert-ALR-000903')).toContain('The capture stopped unexpectedly before the recording was ended.');
    expect(textOf('home-alert-ALR-000903')).not.toContain('Nothing was recorded');
    expect(getMissingKeys()).toEqual([]);
  });

  it('the rule (pure): "no camera" from the alert alone; the generic sentence only for an active alert of a failed start', () => {
    const t = (key: string) => key;
    expect(failedStartAlertLabel(t, noCamera, null)).toBe('common.captureNotice.noCamera.title. common.captureNotice.noCamera.body');
    expect(failedStartAlertLabel(t, { ...noCamera, active: false }, null)).toBe('common.captureNotice.noCamera.title. common.captureNotice.noCamera.body');
    expect(failedStartAlertLabel(t, plainFault, 'OTHER')).toBe('common.session.failedStart.title. common.captureNotice.noCamera.body');
    expect(failedStartAlertLabel(t, plainFault, null)).toBeNull();
    expect(failedStartAlertLabel(t, { ...plainFault, active: false }, 'OTHER')).toBeNull();
    expect(failedStartAlertLabel(t, cameraNotConnected, 'OTHER')).toBeNull();
  });
});

// Wave H, driver B - gate 75 finding G75-07 (b): during a DEGRADED recording (camera 2 lost, camera 1
// recording) the phone Home read "Recording Blocked / A critical fault needs action". Nothing is
// blocked: the session records. Written RED: the title was the idle Core's "Recording Blocked".
describe('G75-07 (b): a critical fault while a session records', () => {
  it('Home says that the recording continues with a critical fault - never "Recording Blocked"; an idle Core with the same fault still says it (control)', async () => {
    const test = await mount();
    act(() => test.sim.actions.inject('CAMERA_LOSS', { cameraId: 'VIDEO-02' }));
    await flushAsync();
    expect(test.sim.store.getState().session?.state).toBe('RECORDING');
    expect(textOf('home-status-title')).toBe('Recording — critical fault');
    expect(textOf('home-status-title')).not.toBe('Recording Blocked');
    expect(textOf('home-status-subtitle')).toContain(test.sim.store.getState().session!.id);
    expect(getMissingKeys()).toEqual([]);

    // CONTROL: no session open and the same camera lost - the Core's pre-check would block: the title stands.
    act(() => test.sim.store.setState({ session: null }));
    await flushAsync();
    expect(textOf('home-status-title')).toBe('Recording Blocked');
  });
});
