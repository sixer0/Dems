// Finalization screen (step 80; 04_mobile_specs §4.6, §3.6, §3.7, §7.3; MA-29 finalize part).
// Renders the real `/session/finalizing` route on the real providers with a test simulator in the
// finalizing scenario (session 0024 stopped 1.6 s ago, step 1 running). Import order matters: the
// gorhom mock, then the router harness, then the flow harness.
import './testing/flow-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { getMissingKeys, resetMissingKeys } from '@/i18n';
import { haptics, resetMotionStateForTests } from '@/motion';
import { resetStampedForTests } from '@/features/session-summary/stamp-once';
import { SEALED_HANDOFF_MS } from './finalizing.model';
import { advanceUntilSealed, renderFlowApp, settle } from './testing/flow-harness';

beforeEach(() => {
  resetMissingKeys();
  resetStampedForTests();
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

/** The pipeline step's accessibility label ("Step 2 of 6, Calculate hashes, in progress"). */
function stepLabel(index: number): string {
  return String(screen.getByTestId(`finalizing-pipeline-step-${index}`).props.accessibilityLabel);
}

/**
 * The percent the Core's state gives (blueprint row 87; the rule of operation 83): the mean of the step
 * percents, floored. Before row 87 the screen counted DONE steps only (0 %, 17 %, …); the two
 * assertions below now hold the Core's own percent, and still bound it by the number of DONE steps.
 */
function corePercent(steps: readonly { status: string; progress?: number }[]): number {
  const sum = steps.reduce((total, step) => total + (step.status === 'done' ? 100 : step.status === 'active' ? Math.min(99, Math.floor(step.progress ?? 0)) : 0), 0);
  return Math.floor(sum / steps.length);
}

describe('Finalization (04 §4.6)', () => {
  it('draws the card: title, mono session ID, progress, the six steps with step 1 running, and the session card', async () => {
    const h = renderFlowApp();
    await settle();
    expect(screen.getByTestId('screen-session-finalizing')).toBeTruthy();
    expect(screen.getByText('Finalizing evidence')).toBeTruthy();
    expect(screen.getByTestId('finalizing-session-id')).toHaveTextContent(h.sessionId!);
    const percentAtStart = corePercent(h.sim.store.getState().session!.finalization.steps);
    // No step is DONE yet: below the 16 % of one finished step.
    expect(percentAtStart).toBeLessThan(16);
    expect(screen.getByTestId('finalizing-progress')).toHaveTextContent(`${percentAtStart}% complete`);
    for (const label of [
      'Close tracks',
      'Finalize hashes',
      'Finalize transcript',
      'Build manifest',
      'Sign manifest',
      'Store sealed evidence package',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(stepLabel(0)).toBe('Step 1 of 6, Close tracks, in progress');
    expect(stepLabel(1)).toBe('Step 2 of 6, Finalize hashes, waiting');
    expect(screen.getByTestId('finalizing-keep-open')).toBeTruthy();
    // Session card: case, subject chip (sim code → Indonesian term), evidence ID assigned at FINALIZING.
    const state = h.sim.store.getState();
    expect(within(screen.getByTestId('finalizing-case')).getByText(state.session!.input.caseNumber)).toBeTruthy();
    expect(within(screen.getByTestId('finalizing-evidence')).getByText(state.session!.evidenceId!)).toBeTruthy();
    expect(screen.getByTestId('pane-finalization')).toBeTruthy();
    expect(screen.getByTestId('pane-session')).toBeTruthy();
    expect(getMissingKeys()).toEqual([]);
  });

  it('resolves the steps on the simulator clock: check, duration, progress', async () => {
    const h = renderFlowApp();
    await settle();
    const first = h.sim.store.getState().session!.finalization.steps[0]!;
    h.run(first.durationMs! + 100);
    expect(stepLabel(0)).toBe('Step 1 of 6, Close tracks, completed');
    expect(stepLabel(1)).toBe('Step 2 of 6, Finalize hashes, in progress');
    expect(screen.getByText(`${(first.durationMs! / 1000).toFixed(1)} s`)).toBeTruthy();
    const percentAfterFirst = corePercent(h.sim.store.getState().session!.finalization.steps);
    // One step is DONE and the second runs: from 16 % up to below 33 %.
    expect(percentAfterFirst).toBeGreaterThanOrEqual(16);
    expect(percentAfterFirst).toBeLessThan(33);
    expect(screen.getByTestId('finalizing-progress')).toHaveTextContent(`${percentAfterFirst}% complete`);
  });

  it('MA-29: FINALIZING → SEALED within 10 s, then the route sync opens the Summary with the violet SEALED stamp', async () => {
    const trigger = jest.spyOn(haptics, 'trigger');
    const h = renderFlowApp();
    await settle();
    act(() => advanceUntilSealed(h));
    const session = h.sim.store.getState().session!;
    expect(session.state).toBe('SEALED');
    expect(session.sealedAt! - session.stoppedAt!).toBeLessThanOrEqual(10_000);
    expect(h.app.getPathname()).toBe(`/session/summary/${h.sessionId}`);
    expect(screen.getByTestId('screen-session-summary')).toBeTruthy();
    expect(within(screen.getByTestId('summary-sealed')).getByText('SEALED')).toBeTruthy();
    expect(trigger.mock.calls.filter(([event]) => event === 'sealedStamp')).toHaveLength(1);
  });

  // CF2-A (RF-PH-3): sealed with the summary pending, the Finalizing route draws the Summary IN PLACE at once
  // (the D201 hand-over recipe); the route follows 1.2 s after the seal. Before, it showed the sealed card
  // ("Evidence sealed", "Opening the session summary…") until the route changed, which on the phones took up to
  // 2 s and cut in with an empty frame.
  it('without the route sync, draws the Summary in place at the seal and opens its route itself 1.2 s after it', async () => {
    const h = renderFlowApp({ routeSync: false });
    await settle();
    act(() => advanceUntilSealed(h));
    expect(h.app.getPathname()).toBe('/session/finalizing');
    expect(screen.getByTestId('screen-session-summary')).toBeTruthy();
    expect(within(screen.getByTestId('summary-sealed')).getByText('SEALED')).toBeTruthy();
    expect(screen.queryByText('Evidence sealed')).toBeNull();
    h.run(SEALED_HANDOFF_MS + 100);
    expect(h.app.getPathname()).toBe(`/session/summary/${h.sessionId}`);
    expect(screen.getByTestId('screen-session-summary')).toBeTruthy();
  });

  it('§3.6: Back while FINALIZING is consumed with "Finalizing — please wait" and changes nothing', async () => {
    const pressBack = spyHardwareBack();
    const h = renderFlowApp();
    await settle();
    expect(pressBack()).toBe(true);
    // The kit renders the toast plus a screen-reader status copy of it.
    expect((await screen.findAllByText('Finalizing — please wait')).length).toBeGreaterThan(0);
    expect(h.app.getPathname()).toBe('/session/finalizing');
    expect(h.sim.store.getState().session?.state).toBe('FINALIZING');
  });

  it('P7: a critical fault turns the running step red once and offers the Recovery status calmly', async () => {
    const h = renderFlowApp({ routeSync: false });
    await settle();
    act(() => h.sim.actions.inject('POWER_FAIL'));
    expect(h.sim.store.getState().session?.state).toBe('FAULT');
    expect(screen.getByTestId('finalizing-interrupted')).toBeTruthy();
    expect(screen.getByText('Finalization interrupted')).toBeTruthy();
    expect(screen.getByText(/^Power failure\. Recovery takes over/)).toBeTruthy();
    expect(stepLabel(0)).toBe('Step 1 of 6, Close tracks, interrupted');
    fireEvent.press(screen.getByTestId('finalizing-open-recovery'));
    expect(h.app.getPathname()).toBe('/session/recovery');
  });

  it('with no session, says so and offers Home', async () => {
    const h = renderFlowApp({ scenario: 'idle' });
    await settle();
    expect(screen.getByText('No finalization in progress')).toBeTruthy();
    fireEvent.press(screen.getByTestId('finalizing-idle-action'));
    expect(h.app.getPathname()).toBe('/home');
    expect(getMissingKeys()).toEqual([]);
  });

  it('tablet landscape puts the session card beside the 720 dp pipeline card', async () => {
    renderFlowApp({ window: 'tabletLandscape' });
    await settle();
    expect(screen.getByTestId('pane-finalization')).toBeTruthy();
    expect(screen.getByTestId('pane-session')).toBeTruthy();
  });
});
