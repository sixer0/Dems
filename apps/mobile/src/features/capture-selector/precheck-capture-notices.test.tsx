/**
 * Session New, the pre-check step: an unreachable capture device (task 3 row 138; ux spec §8e.2
 * situation B, §8e.3, §8g.3 the start rule; decisions D80(2), D80(6), D83, D114; the software half of
 * M4-NODEV-B-T / -P, M4-NODEV-NOCFG-T, M4-MIC-ACTIVE-T / -P). The real Start Session route on the
 * real simulator, as `features/session-new/precheck.test.tsx`.
 *
 * "Unreachable" is `online: false` of the device in `captureDevices`, which the Core writes before a
 * pre-check run; here it is written through the same INTERNAL action (`raiseCaptureWarning`, phase
 * `PRESENCE`), and the alert of the run through phase `PRECHECK`, as row 133's gate does.
 */
import '@/features/session-new/testing/session-new-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { TextInput } from 'react-native';
import { OPERATORS, PRECHECK_TOTAL_MAX_MS, type Sim } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { resetMotionStateForTests } from '@/motion';
import type { TestSim } from '@/runtime/testing/test-sim';
import { renderSessionNewApp, settle, type SessionNewHarness } from '@/features/session-new/testing/session-new-harness';

beforeEach(() => {
  jest.useFakeTimers();
  resetMissingKeys();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
  resetMotionStateForTests();
  expect(getMissingKeys()).toEqual([]);
});

type Warning = Parameters<Sim['actions']['raiseCaptureWarning']>[0];
const absent = (subject: string): Warning => ({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject, phase: 'PRESENCE' }) as Warning;
const atPrecheck = (subject: string, over: Record<string, unknown> = {}): Warning => ({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject, phase: 'PRECHECK', ...over }) as Warning;

function startGate(test: TestSim, operator = 0): void {
  const result = test.sim.actions.createSession({
    caseNumber: 'LP/2026/1001-0008',
    subjectType: 'SAKSI',
    subjectName: 'Rahmat Hidayat',
    investigatorId: OPERATORS[operator]!.id,
    room: 'Interview Room 1',
    profileId: 'STANDARD_1080P25',
  });
  if (!result.ok) throw new Error(`createSession failed: ${result.reason}`);
  test.sim.actions.beginPrecheck();
}

/** Opens the gate with `devices` unreachable, resolves the eight checks, then raises the run's alerts. */
async function openGate(devices: readonly string[], options: { operator?: number; alerts?: readonly Warning[] } = {}) {
  const seen: string[] = [];
  const h: SessionNewHarness = renderSessionNewApp({
    operator: options.operator ?? 1,
    setup: (test) => {
      const real = test.sim.request.bind(test.sim);
      (test.sim as { request: Sim['request'] }).request = (request) => {
        seen.push(`${request.method} ${request.path}`);
        return real(request);
      };
      for (const device of devices) test.sim.actions.raiseCaptureWarning(absent(device));
      startGate(test, options.operator ?? 1);
    },
  });
  await settle();
  h.openFlow('/session/new?step=2');
  h.tick(PRECHECK_TOTAL_MAX_MS);
  for (const alert of options.alerts ?? []) act(() => h.sim.actions.raiseCaptureWarning(alert));
  await settle();
  return { h, seen };
}

const value = (id: string) => screen.getByTestId(`session-new-check-${id}-value`);
const status = (id: string) => screen.getByTestId(`session-new-check-${id}-status`).props.accessibilityLabel as string;
const disabled = (testID: string) => screen.getByTestId(testID).props.accessibilityState?.disabled === true;

describe('one camera of two unreachable: a warning, a degraded start after the acknowledgement (D80(6))', () => {
  it('the row names the device from `params.rule` — never "lens fault" / "no signal" — with the count of the one search of the pre-check', async () => {
    const { h } = await openGate(['CAM-02'], { alerts: [atPrecheck('CAM-02', { searchResponderCount: 1, degraded: true })] });
    expect(h.state().session!.precheck.outcome).toBe('WARN');
    expect(status('LENS_2')).toBe('WARN');
    expect(value('LENS_2')).toHaveTextContent('Camera 2 (CAM-02) is not reachable. The session will record one camera only.');
    expect(value('LENS_2')).not.toHaveTextContent(/fault|no signal|UNREACHABLE/i);
    expect(status('LENS_1')).toBe('PASS');
    const notices = screen.getByTestId('session-new-capture-notices');
    expect(within(notices).getByTestId('session-new-capture-notices-sentence-LENS_2')).toHaveTextContent('Camera 2 (CAM-02) is not reachable. The session will record one camera only.');
    expect(within(notices).getByTestId('session-new-capture-notices-count-LENS_2')).toHaveTextContent('A search found 1 camera.');
    // Start is allowed, degraded, only after the operator acknowledges.
    expect(disabled('session-new-next')).toBe(true);
    fireEvent.press(screen.getByTestId('session-new-acknowledge'));
    expect(disabled('session-new-next')).toBe(false);
    // The existing Retry of the pre-check is still offered beside "Search again".
    expect(screen.getByTestId('session-new-retry-checks')).toBeTruthy();
    expect(screen.getByTestId('session-new-capture-notices-search')).toBeTruthy();
  });

  it('a later run in which the camera answers leaves no notice and no warning row', async () => {
    const { h } = await openGate(['CAM-02'], { alerts: [atPrecheck('CAM-02', { searchResponderCount: 1, degraded: true })] });
    expect(screen.getByTestId('session-new-capture-notices')).toBeTruthy();
    // The Core found it reachable again (row 133 resolves the alert and writes `online`), then the operator presses Retry.
    act(() => h.sim.actions.clearCaptureWarning(atPrecheck('CAM-02')));
    fireEvent.press(screen.getByTestId('session-new-retry-checks'));
    h.tick(PRECHECK_TOTAL_MAX_MS);
    await settle();
    expect(status('LENS_2')).toBe('PASS');
    expect(screen.queryByTestId('session-new-capture-notices')).toBeNull();
    expect(h.state().alerts.filter((alert) => alert.active && alert.kind === 'SYSTEM')).toHaveLength(0);
  });
});

describe('both cameras unreachable: blocked', () => {
  it('both rows BLOCK, the blocked text says a session cannot start, Next stays disabled', async () => {
    const { h } = await openGate(['CAM-01', 'CAM-02']);
    expect(h.state().session!.precheck.outcome).toBe('BLOCK');
    expect(status('LENS_1')).toBe('BLOCK');
    expect(status('LENS_2')).toBe('BLOCK');
    expect(value('LENS_1')).toHaveTextContent('No camera is reachable. A session cannot start.');
    expect(screen.getByTestId('session-new-gate-block')).toHaveTextContent(/No camera is reachable\. A session cannot start\./);
    expect(screen.getByTestId('session-new-gate-block')).not.toHaveTextContent(/fault|UNREACHABLE/);
    expect(disabled('session-new-next')).toBe(true);
    expect(screen.queryByTestId('session-new-acknowledge')).toBeNull();
  });
});

describe('the active microphone unreachable: blocked, with no switch at pre-check (D83; M4-MIC-ACTIVE)', () => {
  it('the row tells the operator to cancel and make the other microphone primary on Devices; no control changes the microphone here', async () => {
    const { h } = await openGate(['MIC-01']);
    expect(h.state().session!.precheck.outcome).toBe('BLOCK');
    expect(status('MIC_PRIMARY')).toBe('BLOCK');
    expect(value('MIC_PRIMARY')).toHaveTextContent('MIC 1 (MIC-01) is the active microphone and is not reachable. Cancel this session, make MIC 2 (MIC-02) the primary microphone on Devices, then start again.');
    expect(status('MIC_STANDBY')).toBe('PASS');
    expect(disabled('session-new-next')).toBe(true);
    // The only actions of the block: the microphone re-read (G17). No toggle, no "use the other one".
    const notices = screen.getByTestId('session-new-capture-notices');
    expect(within(notices).getByTestId('session-new-capture-notices-rescan-action').props.accessibilityLabel).toBe('Search again for microphones');
    expect(within(notices).queryByTestId('session-new-capture-notices-search')).toBeNull();
    expect(screen.queryByTestId(/capture-selector-edit|mic-source|make-primary|use-other/)).toBeNull();
    expect(screen.queryByText(/Use MIC 2|Switch to MIC 2|Make MIC 2 primary/i)).toBeNull();
    // The roles of the selector are untouched by the pre-check.
    expect(h.state().captureConfig.mics.find((mic) => mic.inputId === 'MIC-01')?.role).toBe('PRIMARY');
  });

  it('the standby microphone unreachable is a warning: "no standby microphone", a degraded start after the acknowledgement', async () => {
    const { h } = await openGate(['MIC-02']);
    expect(h.state().session!.precheck.outcome).toBe('WARN');
    expect(status('MIC_STANDBY')).toBe('WARN');
    expect(value('MIC_STANDBY')).toHaveTextContent('MIC 2 (MIC-02) is not reachable. The session will record with no standby microphone.');
    fireEvent.press(screen.getByTestId('session-new-acknowledge'));
    expect(disabled('session-new-next')).toBe(false);
  });
});

describe('the operator without CAPTURE_CONFIG (§8e.3; D80(2); M4-NODEV-NOCFG-T)', () => {
  it('sees the outcome as the notification only: the sentence and the count, "Search again" disabled with the role sentence, Retry works, no list is requested', async () => {
    // Operator 0 is the INVESTIGATOR: SESSION_START without CAPTURE_CONFIG.
    const { h, seen } = await openGate(['CAM-02'], { operator: 0, alerts: [atPrecheck('CAM-02', { searchResponderCount: 2, degraded: true })] });
    expect(value('LENS_2')).toHaveTextContent('Camera 2 (CAM-02) is not reachable. The session will record one camera only.');
    expect(screen.getByTestId('session-new-capture-notices-count-LENS_2')).toHaveTextContent('A search found 2 cameras.');
    expect(disabled('session-new-capture-notices-search')).toBe(true);
    expect(screen.getByTestId('session-new-capture-notices-search-gate')).toHaveTextContent('Requires the Supervisor or Technician role');
    fireEvent.press(screen.getByTestId('session-new-capture-notices-search'));
    await settle();
    expect(seen.filter((line) => line.includes('/capture/'))).toEqual([]);
    expect(screen.queryByTestId('camera-search-list')).toBeNull();
    expect(screen.queryByTestId(/^camera-candidate-/)).toBeNull();
    // Their own Retry (SESSION_START) runs the checks again.
    const before = h.state().session!.precheck.startedAt;
    fireEvent.press(screen.getByTestId('session-new-retry-checks'));
    h.tick(PRECHECK_TOTAL_MAX_MS);
    await settle();
    expect(h.state().session!.precheck.startedAt).not.toBe(before);
    expect(status('LENS_2')).toBe('WARN');
  });

  it('an operator WITH the permission may search again from here: one search, its summary, and the list stays on Devices', async () => {
    const { seen } = await openGate(['CAM-02'], { operator: 1, alerts: [atPrecheck('CAM-02', { searchResponderCount: 0, degraded: true })] });
    expect(disabled('session-new-capture-notices-search')).toBe(false);
    fireEvent.press(screen.getByTestId('session-new-capture-notices-search'));
    await settle();
    expect(seen.filter((line) => line === 'POST /api/v1/capture/discovery')).toHaveLength(1);
    expect(screen.getByTestId('session-new-capture-notices-search-summary')).toHaveTextContent('2 found · 1 new · 1 already registered');
    expect(screen.queryByTestId(/^camera-candidate-/)).toBeNull();
  });
});

describe('nothing unreachable: the step is as before', () => {
  it('draws no notice block, no badge and no text field', async () => {
    await openGate([]);
    expect(screen.queryByTestId('session-new-capture-notices')).toBeNull();
    expect(screen.queryByTestId(/-source$/)).toBeNull();
    expect(screen.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
  });
});
