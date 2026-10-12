// Recovery Status (step 81; 04_mobile_specs §4.8, §3.7; book §6.4 item 5, §18.1; T16).
// Renders the real `/session/recovery` route on the real providers with a test simulator: fault-demo
// (Camera 2 lost, MIC 2 clipping, GNSS → NTP) plus POWER_FAIL puts the session in FAULT, then the
// suite drives FAULT → RECOVERY → INCOMPLETE on the simulator clock. Import order matters: the gorhom
// mock, then the router harness, then the recovery harness.
import './testing/recovery-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { formatClock } from '@dems/shared/realtime';
import { RECOVERY_MS } from '@dems/shared/sim';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { haptics, resetMotionStateForTests } from '@/motion';
import { ACK_SETTLE_MS } from './recovery.model';
import { resetRecoveryHapticsForTests } from './session-recovery-screen';
import { advanceUntilIdle, renderRecoveryApp, settle } from './testing/recovery-harness';

beforeEach(() => {
  resetMissingKeys();
  resetRecoveryHapticsForTests();
});

afterEach(() => {
  resetMotionStateForTests();
  jest.restoreAllMocks();
});

type BackListener = Parameters<typeof BackHandler.addEventListener>[1];

/** Captures hardware-Back listeners so a test can press Back (newest first, as Android does). */
function spyHardwareBack() {
  const listeners: BackListener[] = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    listeners.push(handler);
    return { remove: () => void listeners.splice(listeners.indexOf(handler), 1) };
  });
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

/** The pipeline step's accessibility label ("Step 2 of 5, Track integrity, in progress"). */
function stepLabel(index: number): string {
  return String(screen.getByTestId(`recovery-pipeline-step-${index}`).props.accessibilityLabel);
}

function trackResult(track: string) {
  return within(screen.getByTestId(`recovery-track-${track}-result`));
}

describe('Recovery Status (04 §4.8)', () => {
  it('FAULT: names the fault calmly, waits on the five-step pipeline and offers Start recovery', async () => {
    const trigger = jest.spyOn(haptics, 'trigger');
    const h = renderRecoveryApp();
    await settle();
    const session = h.sim.store.getState().session!;
    expect(session.state).toBe('FAULT');
    expect(screen.getByTestId('screen-session-recovery')).toBeTruthy();
    expect(screen.getByTestId('recovery-session-id')).toHaveTextContent(h.sessionId!);
    expect(within(screen.getByTestId('recovery-state-chip')).getByText('Fault')).toBeTruthy();
    expect(screen.getByText('Session interrupted: Power failure')).toBeTruthy();
    expect(screen.getByText(`Recording stopped at ${formatClock(session.fault!.at)}. The evidence stays unsealed until a controlled recovery analysis has run.`)).toBeTruthy();
    for (let i = 0; i < 5; i += 1) expect(stepLabel(i)).toMatch(/, waiting$/);
    expect(stepLabel(1)).toBe('Step 2 of 5, Track integrity, waiting');
    expect(within(screen.getByTestId('recovery-track-VIDEO-01')).getByText('Waiting')).toBeTruthy();
    expect(screen.getByTestId('recovery-start')).toBeTruthy();
    expect(screen.getByTestId('recovery-start-hint')).toHaveTextContent('Recovery closes the session as incomplete. It never seals it.');
    expect(within(screen.getByTestId('recovery-from-state')).getByText('Recording')).toBeTruthy();
    // §7.6 row 7: one critical-fault haptic for this session.
    expect(trigger.mock.calls.filter(([event]) => event === 'criticalFault')).toHaveLength(1);
    expect(getMissingKeys()).toEqual([]);
  });

  it('drives FAULT → RECOVERY → INCOMPLETE on the simulator clock and asserts each screen state', async () => {
    const h = renderRecoveryApp();
    await settle();
    const before = h.sim.store.getState();
    const camLoss = before.faults.active.find((f) => f.kind === 'CAMERA_LOSS')!;
    const clip = before.faults.active.find((f) => f.kind === 'MIC_CLIP')!;
    const gnss = before.faults.active.find((f) => f.kind === 'GNSS_LOSS')!;

    fireEvent.press(screen.getByTestId('recovery-start'));
    expect(h.sim.store.getState().session?.state).toBe('RECOVERY');
    expect(screen.getByTestId('recovery-analysing')).toBeTruthy();
    expect(screen.getByTestId('recovery-stage')).toHaveTextContent('Recovery scan · stage 1 of 2');
    expect(stepLabel(0)).toBe('Step 1 of 5, Recovery marker and journal, in progress');

    h.run(600);
    expect(stepLabel(0)).toBe('Step 1 of 5, Recovery marker and journal, completed');
    expect(screen.getByText('Recovery marker found')).toBeTruthy();
    expect(stepLabel(1)).toBe('Step 2 of 5, Track integrity, in progress');
    expect(within(screen.getByTestId('recovery-track-VIDEO-01')).getByText('Checking…')).toBeTruthy();
    expect(String(screen.getByTestId('recovery-track-VIDEO-01').props.accessibilityLabel)).toMatch(/Checking…$/);

    h.run(1_000); // 1.6 s: RECOVERY_SCAN is over, the four tracks are resolved
    expect(h.sim.store.getState().session?.recovery?.stage).toBe('INCOMPLETE_SESSION_ANALYSIS');
    expect(screen.getByTestId('recovery-stage')).toHaveTextContent('Incomplete session analysis · stage 2 of 2');
    expect(stepLabel(1)).toBe('Step 2 of 5, Track integrity, needs attention');
    expect(screen.getByText('2 tracks need attention')).toBeTruthy();
    expect(trackResult('VIDEO-01').getByText('INTACT')).toBeTruthy();
    // Fix wave J round two (JA2-17): the row SPEAKS what it shows - it was announced "..., Waiting" beside INTACT.
    expect(String(screen.getByTestId('recovery-track-VIDEO-01').props.accessibilityLabel)).toMatch(/INTACT/);
    expect(String(screen.getByTestId('recovery-track-VIDEO-01').props.accessibilityLabel)).not.toMatch(/Waiting/);
    expect(String(screen.getByTestId('recovery-track-VIDEO-02').props.accessibilityLabel)).toMatch(/GAP\. Signal lost at/);
    expect(trackResult('VIDEO-02').getByText('GAP')).toBeTruthy();
    expect(trackResult('VIDEO-02').getByText(`Signal lost at ${formatClock(camLoss.since)}`)).toBeTruthy();
    expect(trackResult('AUDIO-01').getByText('INTACT')).toBeTruthy();
    expect(trackResult('AUDIO-02').getByText('FLAGGED')).toBeTruthy();
    expect(trackResult('AUDIO-02').getByText(`Clipped segments flagged from ${formatClock(clip.since)}`)).toBeTruthy();
    expect(within(screen.getByTestId('recovery-time-source')).getByText('Pending')).toBeTruthy();

    h.run(RECOVERY_MS - 1_600 + 100); // past 3 s: the simulator keeps the session INCOMPLETE
    const after = h.sim.store.getState();
    expect(after.session).toBeNull();
    const entry = after.sessionHistory.find((e) => e.id === h.sessionId)!;
    expect(entry.outcome).toBe('INCOMPLETE');
    expect(h.app.getPathname()).toBe('/session/recovery');
    expect(screen.getByTestId('recovery-outcome')).toBeTruthy();
    expect(screen.getByTestId('recovery-outcome-line')).toHaveTextContent('Session marked INCOMPLETE. It will never be sealed.');
    expect(within(screen.getByTestId('recovery-state-chip')).getByText('INCOMPLETE')).toBeTruthy();
    expect(within(screen.getByTestId('recovery-outcome-evidence')).getByText(`${entry.evidenceId} (recorded, unsealed)`)).toBeTruthy();
    expect(after.evidence.find((e) => e.id === entry.evidenceId)?.status).toBe('RECORDED');
    expect(stepLabel(3)).toBe('Step 4 of 5, Time-source continuity, needs attention');
    expect(screen.getByText(`GNSS → NTP at ${formatClock(gnss.since)}`)).toBeTruthy();
    expect(stepLabel(4)).toBe('Step 5 of 5, Incomplete session analysis, completed');
    expect(within(screen.getByTestId('recovery-time-source')).getByText(`NTP from ${formatClock(gnss.since)}`)).toBeTruthy();
    expect(screen.queryByTestId('recovery-start')).toBeNull();
    expect(getMissingKeys()).toEqual([]);
  });

  it('Acknowledge marks the fault alert as seen, settles the ring for 600 ms of simulator time, then opens Home', async () => {
    const h = renderRecoveryApp();
    await settle();
    fireEvent.press(screen.getByTestId('recovery-start'));
    act(() => advanceUntilIdle(h));
    fireEvent.press(screen.getByTestId('recovery-acknowledge'));
    expect(h.sim.store.getState().alerts.filter((a) => a.kind === 'POWER_FAIL').every((a) => a.acknowledged)).toBe(true);
    expect(h.app.getPathname()).toBe('/session/recovery');
    h.run(ACK_SETTLE_MS + 100);
    expect(h.app.getPathname()).toBe('/home');
  });

  it('opens the unsealed evidence item from the outcome card', async () => {
    const h = renderRecoveryApp();
    await settle();
    fireEvent.press(screen.getByTestId('recovery-start'));
    act(() => advanceUntilIdle(h));
    const entry = h.sim.store.getState().sessionHistory.find((e) => e.id === h.sessionId)!;
    fireEvent.press(screen.getByTestId('recovery-view-evidence'));
    expect(h.app.getPathname()).toBe(`/evidence/${entry.evidenceId}`);
  });

  it('role gating: a Technician sees the rule and gets the SimPermissionError toast; the session stays in FAULT', async () => {
    const h = renderRecoveryApp({ operator: 2 });
    await settle();
    expect(screen.getByTestId('recovery-start-hint')).toHaveTextContent('Needs an Investigator or Supervisor. You are signed in as Technician.');
    fireEvent.press(screen.getByTestId('recovery-start'));
    expect((await screen.findAllByText('Your role cannot start recovery. Ask an Investigator or Supervisor.')).length).toBeGreaterThan(0);
    expect(h.sim.store.getState().session?.state).toBe('FAULT');
  });

  it('a fault before recording started: no media on any track, no evidence item', async () => {
    const h = renderRecoveryApp({ scenario: 'precheckFault' });
    await settle();
    expect(screen.getByText('The session stopped before recording started. Nothing was recorded.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('recovery-start'));
    act(() => advanceUntilIdle(h));
    expect(trackResult('VIDEO-01').getByText('NO MEDIA')).toBeTruthy();
    expect(screen.getByText('No media to check')).toBeTruthy();
    expect(within(screen.getByTestId('recovery-outcome-evidence')).getByText('None: nothing was recorded')).toBeTruthy();
    expect(screen.queryByTestId('recovery-view-evidence')).toBeNull();
  });

  it('SIM-GAP-M81-1: a SEALED history entry would show RECOVERED · SEALED with the recovery signature', async () => {
    const h = renderRecoveryApp();
    await settle();
    fireEvent.press(screen.getByTestId('recovery-start'));
    act(() => advanceUntilIdle(h));
    const state = h.sim.store.getState();
    const entry = state.sessionHistory.find((e) => e.id === h.sessionId)!;
    const item = state.evidence.find((e) => e.id === entry.evidenceId)!;
    // The simulator never produces this today; the test writes the would-be result directly.
    act(() => {
      h.sim.store.setState({
        sessionHistory: state.sessionHistory.map((e) => (e.id === entry.id ? { ...e, outcome: 'SEALED' } : e)),
        evidence: state.evidence.map((e) => (e.id === item.id ? { ...e, status: 'SEALED' } : e)),
      });
    });
    expect(within(screen.getByTestId('recovery-state-chip')).getByText('RECOVERED · SEALED')).toBeTruthy();
    expect(screen.getByTestId('recovery-outcome-line')).toHaveTextContent('Every check passed. The session was sealed with a recovery signature.');
    expect(screen.getByTestId('recovery-outcome-signature')).toBeTruthy();
  });

  it('Back while the analysis runs is consumed with a calm toast and changes nothing', async () => {
    const pressBack = spyHardwareBack();
    const h = renderRecoveryApp();
    await settle();
    fireEvent.press(screen.getByTestId('recovery-start'));
    expect(pressBack()).toBe(true);
    expect((await screen.findAllByText('Recovery analysis running — please wait')).length).toBeGreaterThan(0);
    expect(h.app.getPathname()).toBe('/session/recovery');
    expect(h.sim.store.getState().session?.state).toBe('RECOVERY');
  });

  it('Back in FAULT with nothing below goes Home instead of leaving the app (F-79-1)', async () => {
    const pressBack = spyHardwareBack();
    const h = renderRecoveryApp();
    await settle();
    expect(pressBack()).toBe(true);
    expect(h.app.getPathname()).toBe('/home');
    expect(h.sim.store.getState().session?.state).toBe('FAULT');
  });

  it('§3.7: a critical fault while the operator is on the monitor routes here (production route sync)', async () => {
    const h = renderRecoveryApp({ scenario: 'recording', initialUrl: '/session/live' });
    await settle();
    expect(h.app.getPathname()).toBe('/session/live');
    act(() => h.sim.actions.inject('POWER_FAIL'));
    expect(h.app.getPathname()).toBe('/session/recovery');
    expect(screen.getByTestId('recovery-fault')).toBeTruthy();
  });

  it('a session that is not interrupted, and no session at all, get a notice with the way out', async () => {
    const recording = renderRecoveryApp({ scenario: 'recording', routeSync: false });
    await settle();
    expect(screen.getByText('This session is not interrupted')).toBeTruthy();
    fireEvent.press(screen.getByTestId('recovery-other-action'));
    expect(recording.app.getPathname()).toBe('/session/live');
    recording.app.unmount();

    const idle = renderRecoveryApp({ scenario: 'idle' });
    await settle();
    expect(screen.getByText('No recovery in progress')).toBeTruthy();
    fireEvent.press(screen.getByTestId('recovery-idle-action'));
    expect(idle.app.getPathname()).toBe('/home');
    expect(getMissingKeys()).toEqual([]);
  });

  it('tablet landscape puts the analysis details pane beside the recovery card', async () => {
    renderRecoveryApp({ window: 'tabletLandscape' });
    await settle();
    expect(screen.getByTestId('pane-recovery')).toBeTruthy();
    expect(screen.getByTestId('pane-recovery-details')).toBeTruthy();
  });
});
