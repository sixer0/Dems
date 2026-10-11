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
import { DEMO_OPERATOR_PASSWORD, type SimAlert, CORE_NOT_RUNNING_LABEL, SEAL_BLOCKED_EXAMPLE_ALERT, SEAL_BLOCKED_EXAMPLE_FINALIZATION, SEAL_BLOCKED_EXAMPLE_SESSION_ID, ScenarioName, coreNotRunningFaultTransition, injectFaultTransition, SEAL_RECORDING_KEPT_SENTENCE, sealBlockedNoticeOf, PLATFORM_NOT_REPORTED } from '@dems/shared/sim';
import { LiveMiniBar } from '@/components/composed/nav/live-mini-bar';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetLoopRegistryForTests, resetMotionStateForTests } from '@/motion';
import { resetCoreLinkPrefsForTests, useActiveSession } from '@/runtime';
import { createTestSim, flushAsync, renderWithRuntime, type TestSim } from '@/runtime/testing/test-sim';
import { DashboardScreen } from './dashboard-screen';
import { failedStartAlertLabel, chipRowFor } from './home-model';
import { CORE_NOT_RUNNING_FAULT_EXAMPLE, SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE } from '@dems/shared/api';
import { timelineOfCaptureFacts } from '@/features/session-live/session-live.math';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';
import { Dimensions } from 'react-native';
import { NoPreviewTile } from '@/features/devices/camera-preview';
import { StorageKpis } from '@/features/storage/storage-kpis';

jest.mock('@shopify/react-native-skia', () =>
  jest.requireActual<typeof import('@/components/media/testing/skia-mock')>('@/components/media/testing/skia-mock').createSkiaMock(),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() }),
  useIsFocused: () => true,
}));

// The cases this file held before the consolidation of the suite (D233), under their own hooks.
describe('session start home', () => {
unmountBeforeTheHooksOfThisGroup();

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
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `pass-j-home.test.tsx` (test-suite consolidation, D233): every case as it was.
// Closing pass J of fix wave I (decisions D216, D217 (5), (7)) - the mobile Home.
//
// | Item | Rule | Member read BY NAME |
// |---|---|---|
// | 1 G75b-06 at the source | the Security chip reads "Not reported" where the Core says it computes no posture | `security.platformNotReported` (`SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE`) |
// | 2 G75b-03 | the restart fault of a Core in its own capture reads "Core was not running", never "Power failure" | `coreNotRunning` (`CORE_NOT_RUNNING_FAULT_EXAMPLE`) |
// | 4 | a blocked seal is the CRITICAL state by the Core's alert, with no fault flag | `sealBlockedNoticeOf` (`SEAL_BLOCKED_EXAMPLE_ALERT`) |
// | 3 | the phone History badge counts the timeline rows that are drawn | `session.captureDurable` |
describe('Home on a Core in its own capture: Security chip, restart fault, blocked seal, History badge', () => {
unmountBeforeTheHooksOfThisGroup();
const textOf = (testID: string): string => {
  const parts: string[] = [];
  const walk = (n: ReactTestInstance | string) => {
    if (typeof n === 'string') parts.push(n);
    else n.children.forEach(walk);
  };
  walk(screen.getAllByTestId(testID)[0]!);
  return parts.join('');
};

async function mount(scenario: ScenarioName): Promise<TestSim> {
  const test = createTestSim();
  expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  test.sim.actions.loadScenario(scenario);
  renderWithRuntime(<DashboardScreen />, { sim: test.sim });
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
  resetMotionStateForTests({ linkMotion: 'off' });
  resetLoopRegistryForTests();
  resetMissingKeys();
});
afterEach(() => {
  cleanup();
  expect(getMissingKeys()).toEqual([]);
});

describe('1. the Security chip follows security.platformNotReported', () => {
  const base = { timeSource: 'GNSS', timeLocked: true, linkUp: true };
  const security = (input: Parameters<typeof chipRowFor>[0]) => chipRowFor(input).find((chip) => chip.id === 'security');

  it('the member with a posture that would read "Secure": "Not reported", neutral', () => {
    expect(SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE).toEqual({ platformNotReported: true });
    expect(security({ ...base, posture: 'SECURE', ...SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE })).toMatchObject({ valueKey: 'common.platformNotReported.value', tone: 'default' });
  });

  it('CONTROL - without the member (the simulated device, and a host clock alone): "Secure"; a posture that names a fault keeps it', () => {
    expect(security({ ...base, posture: 'SECURE' })).toMatchObject({ valueKey: 'common.posture.SECURE', tone: 'success' });
    expect(security({ ...base, posture: 'SECURE', hostClock: true })).toMatchObject({ valueKey: 'common.posture.SECURE', tone: 'success' });
    expect(security({ ...base, posture: 'CRITICAL', platformNotReported: true })).toMatchObject({ valueKey: 'common.posture.CRITICAL', tone: 'danger' });
  });
});

describe('2. the restart fault of a Core in its own capture on Home', () => {
  it('the flag line reads "Core was not running" - never "Power failure"', async () => {
    const test = await mount(ScenarioName.RECORDING);
    act(() => test.sim.store.setState((s) => coreNotRunningFaultTransition(s, s.clock.now)));
    await flushAsync();
    expect(test.sim.store.getState().session?.fault).toMatchObject({ kind: 'POWER_FAIL', ...CORE_NOT_RUNNING_FAULT_EXAMPLE });
    const flags = textOf('home-status-flags');
    expect(flags).toContain(CORE_NOT_RUNNING_LABEL);
    expect(flags).not.toMatch(/power\s*fail/i);
  });

  it('CONTROL - the simulator\'s own power failure still reads "Power failure"', async () => {
    const test = await mount(ScenarioName.RECORDING);
    act(() => test.sim.store.setState((s) => injectFaultTransition(s, s.clock.now, 'POWER_FAIL')));
    await flushAsync();
    const flags = textOf('home-status-flags');
    expect(flags).toContain('Power failure');
    expect(flags).not.toContain(CORE_NOT_RUNNING_LABEL);
  });
});

describe('4. a blocked seal is the critical state of Home through the alert', () => {
  const block = (test: TestSim, active: boolean) =>
    act(() =>
      test.sim.store.setState((s) => ({
        session: { ...s.session!, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING', finalization: SEAL_BLOCKED_EXAMPLE_FINALIZATION },
        alerts: [{ ...SEAL_BLOCKED_EXAMPLE_ALERT, active }],
        faults: { active: [] },
        tabletLink: { ...s.tabletLink, state: 'CONNECTED' },
      })),
    );
  const ringState = () => screen.getAllByTestId('home-status-ring')[0]!.props.accessibilityLabel as string;

  it('the ring reads Critical with NO fault active', async () => {
    const test = await mount(ScenarioName.FINALIZING);
    block(test, true);
    await flushAsync();
    expect(test.sim.store.getState().faults.active).toEqual([]);
    expect(ringState()).toMatch(/critical/i);
    expect(textOf('home-status-title')).toBe('Sealing blocked');
  });

  it('NEGATIVE CONTROL - the same session with the alert resolved: not critical', async () => {
    const test = await mount(ScenarioName.FINALIZING);
    block(test, false);
    await flushAsync();
    expect(ringState()).not.toMatch(/critical/i);
    expect(textOf('home-status-title')).not.toBe('Sealing blocked');
  });
});

describe('3. the History badge counts the rows the timeline draws', () => {
  const rows = [{ kind: 'START' }, { kind: 'NOTE' }, { kind: 'MARKER' }];

  it('while the cameras connect the held-back START row is not counted; from the first durable fragment it is', () => {
    expect(timelineOfCaptureFacts(rows, true, true).length).toBe(2);
    expect(timelineOfCaptureFacts(rows, true, false).length).toBe(3);
    // CONTROL: the simulator's own recording counts every row.
    expect(timelineOfCaptureFacts(rows, false, false).length).toBe(3);
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-i-c-seal-blocked-home.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave I, driver C - re-gate 75 finding G75b-02, the Home half: after the operator leaves the
// Finalizing screen of a BLOCKED seal, Home shows that session as "Sealing blocked" and explains why
// a new session is not available - instead of "Recording Blocked / A critical fault needs action"
// and a plain "View finalization".
//
// The Core's payloads are the contract's own examples (`@dems/shared/sim` `seal-blocked.ts`), never
// retyped (D208). Written RED.
describe('Home and a blocked seal', () => {
unmountBeforeTheHooksOfThisGroup();
const textOf = (testID: string): string => {
  const parts: string[] = [];
  const walk = (n: ReactTestInstance | string) => {
    if (typeof n === 'string') parts.push(n);
    else n.children.forEach(walk);
  };
  walk(screen.getAllByTestId(testID)[0]!);
  return parts.join('');
};

async function mountFinalizing(): Promise<TestSim> {
  const test = createTestSim();
  expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  test.sim.actions.loadScenario(ScenarioName.FINALIZING);
  expect(test.sim.store.getState().session?.state).toBe('FINALIZING');
  renderWithRuntime(<DashboardScreen />, { sim: test.sim });
  await flushAsync();
  return test;
}
/** The Core reports the blocked seal of the open session (the contract's example session, steps and alert). */
const block = (test: TestSim) =>
  act(() =>
    test.sim.store.setState((s) => ({
      session: { ...s.session!, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING', finalization: SEAL_BLOCKED_EXAMPLE_FINALIZATION },
      alerts: [...s.alerts, SEAL_BLOCKED_EXAMPLE_ALERT],
    })),
  );

beforeAll(async () => {
  // Reanimated's UI-side frame-callback registry initialises on real timers (S72-12).
  await new Promise((resolve) => setTimeout(resolve, 50));
});
beforeEach(async () => {
  await AsyncStorage.clear();
  resetCoreLinkPrefsForTests();
  resetMotionStateForTests({ linkMotion: 'off' });
  resetLoopRegistryForTests();
  resetMissingKeys();
});
afterEach(() => {
  cleanup();
  expect(getMissingKeys()).toEqual([]);
});

describe('G75b-02 on Home: the open session whose seal is blocked', () => {
  it('the status card says "Sealing blocked" with the session and "The recording is kept on the Core." - not "Recording Blocked"', async () => {
    const test = await mountFinalizing();
    block(test);
    await flushAsync();
    expect(sealBlockedNoticeOf(test.sim.store.getState(), SEAL_BLOCKED_EXAMPLE_SESSION_ID)).not.toBeNull();
    expect(textOf('home-status-title')).toBe('Sealing blocked');
    expect(textOf('home-status-subtitle')).toContain(SEAL_BLOCKED_EXAMPLE_SESSION_ID);
    expect(textOf('home-status-subtitle')).toContain(SEAL_RECORDING_KEPT_SENTENCE);
    expect(textOf('home-status-title')).not.toMatch(/Recording Blocked/);
  });

  it('the primary action leads to the blocked session by name, and a line explains why a new session is not available', async () => {
    const test = await mountFinalizing();
    block(test);
    await flushAsync();
    const action = screen.getByTestId('home-action-primary');
    expect(action.props.accessibilityLabel).toBe('Sealing blocked: view');
    expect(action.props.accessibilityState?.disabled).not.toBe(true);
    expect(textOf('home-action-seal-blocked')).toBe(
      `A new session cannot be started: sealing of session ${SEAL_BLOCKED_EXAMPLE_SESSION_ID} is blocked, and the Core records no new session until it is sealed. ${SEAL_RECORDING_KEPT_SENTENCE}`,
    );
  });

  it('CONTROL - a seal that simply runs: "View finalization", no blocked line, and the status card as before', async () => {
    await mountFinalizing();
    expect(screen.getByTestId('home-action-primary').props.accessibilityLabel).toBe('View finalization');
    expect(screen.queryByTestId('home-action-seal-blocked')).toBeNull();
    expect(textOf('home-status-title')).not.toBe('Sealing blocked');
  });

  it('the alert resolved (the seal completed or the session was ended): the blocked words leave', async () => {
    const test = await mountFinalizing();
    block(test);
    await flushAsync();
    act(() => test.sim.store.setState((s) => ({ alerts: s.alerts.map((alert) => (alert.id === SEAL_BLOCKED_EXAMPLE_ALERT.id ? { ...alert, active: false } : alert)) })));
    await flushAsync();
    expect(screen.queryByTestId('home-action-seal-blocked')).toBeNull();
    expect(textOf('home-status-title')).not.toBe('Sealing blocked');
  });
});
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-k-m2-connecting-home.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave K, driver M2 - item 3 (G75c-07; ux 8e.2: no recording indicator and no meters before the
// first durable fragment) and item 5 (the real-capture facts of Home and Storage; the mirror of the
// web's C-2).
//
// | Finding | Rule | Where |
// |---------|------|-------|
// | G75c-07 | The tablet Home header chip reads CONNECTING (neutral), never RECORDING, while `captureDurable` is false | "the header chip" |
// | G75c-07 | A Home microphone tile draws no meter, no level and no Active / Standby then | "the microphone tiles" |
// | G75c-07 | The "No preview" tile of a camera with no named cause reads "Connecting cameras…", not "Not reachable" | "the no-preview tile" |
// | C-2 mirror | On a Core that states `security.platformNotReported` the Storage write speed and time left read "Not reported" (no 8.2 GB/h) | "storage" |
// Each case holds its CONTROL: a durable session / the simulated device keeps its words.
describe('Home while the cameras connect, and the real-capture facts', () => {
unmountBeforeTheHooksOfThisGroup();
const TABLET = { width: 1280, height: 800 };
const PHONE = { width: 411, height: 923 };
const setWindow = ({ width, height }: { width: number; height: number }) =>
  act(() => {
    Dimensions.set({ window: { width, height, scale: 2, fontScale: 1 }, screen: { width, height, scale: 2, fontScale: 1 } });
  });

const textOf = (testID: string): string => {
  const parts: string[] = [];
  const walk = (n: ReactTestInstance | string) => {
    if (typeof n === 'string') parts.push(n);
    else n.children.forEach(walk);
  };
  walk(screen.getAllByTestId(testID)[0]!);
  return parts.join('');
};
const count = (testID: string | RegExp): number => screen.queryAllByTestId(testID).length;
const setDurable = (test: TestSim, captureDurable: boolean) => act(() => test.sim.store.setState((s) => ({ session: { ...s.session!, captureDurable } })));

function recording(): TestSim {
  const test = createTestSim({ scenario: 'recording' });
  expect(test.sim.actions.signIn('budi.santoso', DEMO_OPERATOR_PASSWORD).ok).toBe(true);
  expect(test.sim.store.getState().session?.state).toBe('RECORDING');
  return test;
}

beforeAll(async () => {
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
  setWindow(PHONE);
  expect(getMissingKeys()).toEqual([]);
});

describe('G75c-07 - Home while the cameras connect', () => {
  it('the header chip (tablet): RECORDING for a durable session; CONNECTING, never RECORDING, before the first durable fragment', async () => {
    setWindow(TABLET);
    const test = recording();
    renderWithRuntime(<DashboardScreen />, { sim: test.sim });
    await flushAsync();
    // CONTROL: a session without the member (and a durable one) is a recording.
    expect(textOf('home-header-state')).toBe('RECORDING');
    setDurable(test, false);
    expect(textOf('home-header-state')).toBe('CONNECTING');
    expect(screen.queryByText('RECORDING')).toBeNull();
    setDurable(test, true);
    expect(textOf('home-header-state')).toBe('RECORDING');
  });

  it('the microphone tiles (tablet): no meter, no dBFS and no Active / Standby before the first durable fragment; the word CONNECTING in their place', async () => {
    setWindow(TABLET);
    const test = recording();
    renderWithRuntime(<DashboardScreen />, { sim: test.sim });
    await flushAsync();
    // CONTROL: the durable recording draws both meters.
    for (const track of ['AUDIO-01', 'AUDIO-02']) {
      expect(count(`home-device-${track}-meter`)).toBeGreaterThan(0);
      expect(count(`home-device-${track}-connecting`)).toBe(0);
    }
    setDurable(test, false);
    for (const track of ['AUDIO-01', 'AUDIO-02']) {
      expect(count(`home-device-${track}-meter`)).toBe(0);
      expect(count(`home-device-${track}-dbfs`)).toBe(0);
      expect(count(`home-device-${track}-role`)).toBe(0);
      expect(textOf(`home-device-${track}-connecting`)).toBe('CONNECTING');
      expect(String(screen.getAllByTestId(`home-device-${track}-connecting`)[0]!.props.accessibilityLabel)).toMatch(/: Connecting cameras…$/);
    }
    setDurable(test, true);
    for (const track of ['AUDIO-01', 'AUDIO-02']) expect(count(`home-device-${track}-meter`)).toBeGreaterThan(0);
  });

  it('the no-preview tile: "Connecting cameras…" while the session connects; the roster\'s word otherwise', async () => {
    const test = recording();
    const cameraId = test.sim.store.getState().captureConfig.cameras.find((line) => line.trackId === 'VIDEO-01')!.deviceId;
    // The Core has not reached the camera yet (its roster entry is offline) and names no cause.
    act(() => test.sim.store.setState((s) => ({ captureDevices: { ...s.captureDevices, devices: s.captureDevices.devices.map((device) => (device.id === cameraId ? { ...device, online: false } : device)) } })));
    renderWithRuntime(<NoPreviewTile trackId="VIDEO-01" name="CAM 1" />, { sim: test.sim });
    await flushAsync();
    // CONTROL: outside the connecting phase the roster's own word stands.
    expect(textOf('no-preview-VIDEO-01-state')).toBe('Not reachable');
    setDurable(test, false);
    expect(textOf('no-preview-VIDEO-01-state')).toBe('Connecting cameras…');
    expect(screen.queryByText('Not reachable')).toBeNull();
    setDurable(test, true);
    expect(textOf('no-preview-VIDEO-01-state')).toBe('Not reachable');
  });
});

describe('the real-capture facts of Home and Storage (mirror of the web\'s C-2)', () => {
  const ownCapture = (test: TestSim) => act(() => test.sim.store.setState((s) => ({ security: { ...s.security, ...PLATFORM_NOT_REPORTED } })));

  it('storage: on a Core that states `security.platformNotReported` the write speed and the time left read "Not reported" - no MB/s, no 8.2 GB/h', async () => {
    const test = recording();
    renderWithRuntime(<StorageKpis variant="tiles" />, { sim: test.sim });
    await flushAsync();
    const all = () => {
      const parts: string[] = [];
      const walk = (n: ReactTestInstance | string) => {
        if (typeof n === 'string') parts.push(n);
        else n.children.forEach(walk);
      };
      walk(screen.UNSAFE_root);
      return parts.join(' | ');
    };
    // SIMULATED, pinned: the simulated device keeps its figures.
    expect(all()).toMatch(/8\.2 GB\/h/);
    expect(all()).toMatch(/MB\/s/);
    expect(all()).not.toMatch(/Not reported/);
    ownCapture(test);
    expect(all()).not.toMatch(/GB\/h/);
    expect(all()).not.toMatch(/MB\/s/);
    expect(all().match(/Not reported/g)?.length).toBe(2);
  });

  it('home chips: posture "Not reported" and "Host system clock" on such a Core; the simulated device keeps "Secure" and its time source', () => {
    const real = chipRowFor({ posture: 'SECURE', platformNotReported: true, timeSource: 'RTC', timeLocked: false, hostClock: true, linkUp: true });
    expect(real.find((chip) => chip.id === 'security')).toMatchObject({ valueKey: 'common.platformNotReported.value', tone: 'default' });
    expect(real.find((chip) => chip.id === 'time')).toMatchObject({ valueKey: 'session.captureFacts.timeSource.hostClock' });
    // SIMULATED, pinned.
    const simulated = chipRowFor({ posture: 'SECURE', timeSource: 'GNSS', timeLocked: true, linkUp: true });
    expect(simulated.find((chip) => chip.id === 'security')).toMatchObject({ valueKey: 'common.posture.SECURE', tone: 'success' });
    expect(simulated.find((chip) => chip.id === 'time')).toMatchObject({ valueKey: 'common.status.synchronized', tone: 'success' });
  });
});
});
