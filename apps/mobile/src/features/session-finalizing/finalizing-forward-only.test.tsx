// Blueprint row 87 (M7-W6; MB-04, MB-05; UX spec flows 3 and 4; E-13; backlog B9 = FXR-DEV-2).
//
// | Rule | Where |
// |------|-------|
// | The percent, the step statuses and the ETA are the Core's; a lower value is never drawn | "forward-only on the screen" |
// | NEGATIVE CONTROL: without a new Core state nothing moves, however long the screen waits | "forward-only on the screen" |
// | A resumed seal says so and keeps its DONE steps | "a resumed seal" |
// | B9: a copy that is part of a hand-over starts NO Reanimated motion: no entering, no overlay, still Spinners | "B9" |
// | Positive control: entered on its own, the pipeline keeps its motion (the check can see one) | "B9" |
// | B9: the SEALED stamp's rest state is React's; a motion that never starts still ends in the drawn stamp | "the SEALED stamp" |
//
// The software part of M7-FF-TAB / M7-FF-PHONE and of "no Reanimated lost-update warning at the Finalizing
// hand-over"; the device runs (logcat) are scripted for the M7 gate.
import './testing/flow-test-setup';
import '@/navigation/testing/router-harness';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, within } from '@testing-library/react-native';
import { router, type Href } from 'expo-router';
import { HeroUINativeProvider, Spinner } from 'heroui-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { FINALIZATION_STEPS_V2 } from '@dems/shared/domain';
import { en } from '@dems/shared/i18n';
import type { FinalizationStepState, Sim } from '@dems/shared/sim';
import { resetMotionStateForTests } from '@/motion';
import { resetStampedForTests } from '@/features/session-summary/stamp-once';
import { resetSummaryHandoffForTests } from '@/features/session-summary/summary-handoff';
import { markFinalizingHandover, resetFinalizingHandoverForTests } from './handover';
import { STAMP_BUDGET_MS, SealedStamp } from './sealed-stamp';
import { advanceUntilSealed, renderFlowApp, settle } from './testing/flow-harness';

const F = en.session.finalization;
const IDS = FINALIZATION_STEPS_V2;

beforeEach(() => {
  resetFinalizingHandoverForTests();
  resetSummaryHandoffForTests();
  resetStampedForTests();
});
afterEach(() => {
  resetMotionStateForTests();
  resetFinalizingHandoverForTests();
  resetSummaryHandoffForTests();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

type StepPatch = Pick<FinalizationStepState, 'status'> & Partial<Pick<FinalizationStepState, 'progress' | 'etaMs' | 'attempt'>>;

/** Six steps: the first `done` are DONE, the next runs at `progress`, the rest wait. */
function coreSteps(done: number, progress: number, patch: Partial<StepPatch> = {}): StepPatch[] {
  return IDS.map((_, index) => {
    if (index < done) return { status: 'done', progress: 100, attempt: 1 };
    if (index === done) return { status: 'active', progress, attempt: 1, ...patch };
    return { status: 'pending', progress: 0, attempt: 1 };
  });
}

/** The Core sends a finalization state (the manual clock stands still: nothing else changes). */
function coreSends(sim: Sim, list: readonly StepPatch[]): void {
  act(() => {
    sim.store.setState((s) => {
      const session = s.session!;
      const steps = session.finalization.steps.map((step, index) => ({ ...step, ...list[index] }));
      return { session: { ...session, finalization: { ...session.finalization, steps } } };
    });
  });
}

const progressText = () => String(within(screen.getByTestId('finalizing-progress')).getByText(/complete/).props.children);
const percentText = (percent: number) => F.progress.replace('{{percent}}', String(percent));
const stepLabel = (index: number): string => String(screen.getByTestId(`finalizing-pipeline-step-${index}`).props.accessibilityLabel);

describe('forward-only on the screen (M7-FF-TAB / M7-FF-PHONE, software part)', () => {
  it("draws the Core's percent and ETA, moves only when the Core sends a state, and never back", async () => {
    const h = renderFlowApp();
    await settle();
    coreSends(h.sim, coreSteps(2, 40, { etaMs: 6_000 }));
    expect(progressText()).toBe(percentText(40));
    expect(screen.getByTestId('finalizing-eta-core')).toHaveTextContent(F.eta.replace('{{seconds}}', '6'));
    expect(stepLabel(2)).toMatch(/in progress$/);
    expect(screen.getByText('40%')).toBeTruthy();

    // NEGATIVE CONTROL: the screen waits more than a second, the Core sends nothing: the same percent, the same ETA.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
    });
    expect(progressText()).toBe(percentText(40));
    expect(screen.getByTestId('finalizing-eta-core')).toHaveTextContent(F.eta.replace('{{seconds}}', '6'));

    // A lower value from the Core is not drawn.
    coreSends(h.sim, coreSteps(2, 10, { etaMs: 9_000 }));
    expect(progressText()).toBe(percentText(40));
    expect(screen.getByText('40%')).toBeTruthy();
    // A higher one is.
    coreSends(h.sim, coreSteps(3, 20, { etaMs: 3_000 }));
    expect(progressText()).toBe(percentText(53));
    expect(stepLabel(2)).toMatch(/completed$/);
    expect(stepLabel(3)).toMatch(/in progress$/);
  });

  it('no ETA from the Core: "estimating", and no number', async () => {
    const h = renderFlowApp();
    await settle();
    coreSends(h.sim, coreSteps(1, 5, { etaMs: null }));
    const line = screen.getByTestId('finalizing-eta-none');
    expect(line).toHaveTextContent(F.estimating);
    expect(String(line.props.children)).not.toMatch(/\d/);
    expect(screen.queryByTestId('finalizing-eta-core')).toBeNull();
  });
});

describe('a resumed seal (flow 4)', () => {
  it('the DONE steps stay DONE, the percent stays, and the note says "Resumed after restart"', async () => {
    const h = renderFlowApp();
    await settle();
    coreSends(h.sim, coreSteps(4, 40));
    expect(progressText()).toBe(percentText(73));
    expect(screen.queryByTestId('finalizing-resumed')).toBeNull();
    // RECOVERY resumes from an earlier checkpoint: step 3 runs again at attempt 2.
    coreSends(
      h.sim,
      IDS.map((_, index) => (index < 2 ? { status: 'done', progress: 100, attempt: 1 } : index === 2 ? { status: 'active', progress: 5, attempt: 2 } : { status: 'pending', progress: 0, attempt: 1 })),
    );
    expect(progressText()).toBe(percentText(73));
    for (const index of [0, 1, 2, 3]) expect(stepLabel(index)).toMatch(/completed$/);
    expect(screen.getByTestId('finalizing-resumed')).toHaveTextContent(F.resumed);
  });
});

// ── B9 ───────────────────────────────────────────────────────────────────────────────────────

/** Every Reanimated motion declared below `root`: `entering` props, motion overlays, kit Spinners that animate. */
function motionBelow(root: ReactTestInstance): { entering: number; overlays: string[]; spinning: number; spinners: number } {
  const entering = root.findAll((node) => typeof node.type !== 'string' && node.props?.entering != null, { deep: true }).length;
  const overlays = [
    ...new Set(
      root
        .findAll((node) => typeof node.props?.testID === 'string' && /-motion$/.test(node.props.testID as string), { deep: true })
        .map((node) => String(node.props.testID)),
    ),
  ];
  const spinners = root.findAll((node) => node.type === Spinner, { deep: true });
  return { entering, overlays, spinning: spinners.filter((node) => node.props.animation !== 'disable-all').length, spinners: spinners.length };
}

describe('B9 (FXR-DEV-2 with MB-04): React draws the Finalizing hand-over', () => {
  it("the route's copy after a hand-over starts no Reanimated motion, through every step, and still draws every state", async () => {
    const h = renderFlowApp({ routeSync: false, initialUrl: '/home' });
    await settle();
    // The in-place copy on `/session/live` marked the session; the Finalizing route then mounts its own copy.
    markFinalizingHandover(h.sessionId);
    act(() => router.replace('/session/finalizing' as Href));
    await settle();
    const root = () => screen.getByTestId('screen-session-finalizing');
    expect(motionBelow(root())).toMatchObject({ entering: 0, overlays: [], spinning: 0 });
    expect(motionBelow(root()).spinners).toBeGreaterThan(0);
    expect(stepLabel(0)).toMatch(/in progress$/);

    // Step by step to the last one: at every step change the final state is drawn and nothing animates.
    for (let index = 0; index < IDS.length - 1; index += 1) {
      const step = h.sim.store.getState().session!.finalization.steps[index]!;
      h.run(step.startedAt! + step.durationMs! - h.sim.store.getState().clock.now + 50);
      expect(stepLabel(index)).toMatch(/completed$/);
      expect(stepLabel(index + 1)).toMatch(/in progress$/);
      // The check of the finished step is the React-drawn one (it sits in a subtree hidden from TalkBack).
      expect(screen.queryAllByTestId(`finalizing-pipeline-badge-${index}-check`, { includeHiddenElements: true }).length).toBeGreaterThan(0);
      expect(motionBelow(root())).toMatchObject({ entering: 0, overlays: [], spinning: 0 });
    }
  });

  it('positive control: entered on its own (no hand-over), the pipeline keeps its motion', async () => {
    const h = renderFlowApp({ routeSync: false });
    await settle();
    const root = () => screen.getByTestId('screen-session-finalizing');
    const atMount = motionBelow(root());
    expect(atMount.entering).toBeGreaterThan(0);
    expect(atMount.spinning).toBeGreaterThan(0);
    const first = h.sim.store.getState().session!.finalization.steps[0]!;
    h.run(first.durationMs! + 100);
    expect(motionBelow(root()).overlays.length).toBeGreaterThan(0);
  });

  it('the Summary drawn at the seal, and the copy the route puts in its place, start no Stepper motion', async () => {
    const h = renderFlowApp();
    await settle();
    act(() => advanceUntilSealed(h));
    expect(h.app.getPathname()).toBe(`/session/summary/${h.sessionId}`);
    const summary = screen.getByTestId('screen-session-summary');
    const steppers = [screen.getByTestId('summary-pipeline'), screen.getByTestId('summary-lifecycle-stepper')];
    for (const stepper of steppers) expect(motionBelow(stepper)).toMatchObject({ entering: 0, overlays: [], spinning: 0 });
    // The cards do not rise either (CF2-A). The stamp played once, in the copy drawn in place; the route's copy
    // that replaced it shows the stamp at rest. So this copy declares no motion at all.
    expect(motionBelow(summary)).toMatchObject({ entering: 0, overlays: [], spinning: 0 });
    expect(screen.getByTestId('summary-sealed-rest').props.style).toEqual({ opacity: 1, transform: [{ scale: 1 }] });
  });
});

describe('B9: the SEALED stamp holds its rest state in React', () => {
  const stamp = (play: boolean) =>
    render(
      <HeroUINativeProvider>
        <SealedStamp play={play} label="SEALED" accessibilityLabel="Evidence sealed" testID="stamp" />
      </HeroUINativeProvider>,
    );
  const restStyle = (): unknown => screen.getByTestId('stamp-rest').props.style;

  it('play false: the rest state at once, no motion view', () => {
    stamp(false);
    expect(restStyle()).toEqual({ opacity: 1, transform: [{ scale: 1 }] });
    expect(screen.queryByTestId('stamp-motion')).toBeNull();
    expect(within(screen.getByTestId('stamp')).getAllByText('SEALED')).toHaveLength(1);
  });

  it('a motion that never starts (no layout ever arrives): after the budget React draws the stamp at opacity 1, scale 1', () => {
    jest.useFakeTimers();
    stamp(true);
    expect(screen.getByTestId('stamp-motion')).toBeTruthy();
    expect(screen.queryByTestId('stamp-rest')).toBeNull();
    // One chip at any time: never two "SEALED" in the stamp.
    expect(within(screen.getByTestId('stamp')).getAllByText('SEALED')).toHaveLength(1);
    act(() => {
      jest.advanceTimersByTime(STAMP_BUDGET_MS - 50);
    });
    expect(screen.getByTestId('stamp-motion')).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(screen.queryByTestId('stamp-motion')).toBeNull();
    expect(restStyle()).toEqual({ opacity: 1, transform: [{ scale: 1 }] });
    expect(within(screen.getByTestId('stamp')).getAllByText('SEALED')).toHaveLength(1);
  });

  it('the motion starts at the layout of its own view (the native view exists), not in the commit that mounts it', () => {
    jest.useFakeTimers();
    stamp(true);
    const motion = screen.getByTestId('stamp-motion');
    expect(typeof motion.props.onLayout).toBe('function');
    // Starting twice is one start: a second layout event does not restart the stamp.
    act(() => {
      motion.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 96, height: 32 } } });
      motion.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 96, height: 32 } } });
    });
    act(() => {
      jest.advanceTimersByTime(STAMP_BUDGET_MS + 50);
    });
    expect(restStyle()).toEqual({ opacity: 1, transform: [{ scale: 1 }] });
  });
});
