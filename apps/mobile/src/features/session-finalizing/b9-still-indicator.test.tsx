// Wave H, driver B - gate 89 finding G89-02 (B9 = FXR-DEV-2, MB-04): the logcat criterion "0 lines of
// `Unable to find SurfaceMountingManager for tag`" from the stop to the Summary FAILED on every
// hand-over: 70 lines on the tablet (6 tags), 110 on the phone (7 tags: 5, 7, 9, 11, 13, 15, 50).
//
// WHAT THE SAVED LOGCAT SAYS (`.cache/gates/89/logcat_P.txt`): each line is Reanimated's
// `synchronouslyUpdateUIProps failed for tag N` - a prop write to a view that is gone - retried at
// every later event dispatch (the stack enters through `SvgView.onDraw`: one retry per drawn SVG,
// which is why the count grows by two with every finished step and jumps at the Summary). ONE NEW TAG
// PER RUNNING INDICATOR THAT IS REMOVED: the Spinner of the status line (STOPPING, the phone's 7th)
// and the Spinner of each of the six pipeline steps. Row 87 passed the kit Spinner
// `animation="disable-all"`; that stops the rotation but the Spinner still owns a shared value and
// an animated style, and its effect cleanup calls `cancelAnimation(rotation)` WHEN IT UNMOUNTS -
// which is one more write to the tag that is being removed.
//
// What a jest test can observe, and does here: on a copy that is part of a hand-over (`animate`
// false / the route's copy after a hand-over) NO kit Spinner is mounted at all, and the removal of a
// running indicator calls `cancelAnimation` zero times. Written RED: one Spinner per running step,
// one `cancelAnimation` per removal. The device result (logcat = 0) is NOT provable here.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import './testing/flow-test-setup';
import '@/navigation/testing/router-harness';

import { act, render, screen } from '@testing-library/react-native';
import { HeroUINativeProvider, Spinner } from 'heroui-native';
import type { ReactNode } from 'react';
import type { StepStatus } from '@/components/composed/stepper';
import { resetMotionStateForTests } from '@/motion';
import { FinalizationPipeline } from './finalization-pipeline';
import { markFinalizingHandover } from './handover';
import { renderFlowApp, settle } from './testing/flow-harness';

const mockCancelled: unknown[] = [];
jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<Record<string, unknown>>('react-native-reanimated');
  return {
    __esModule: true,
    ...actual,
    cancelAnimation: (value: unknown) => {
      mockCancelled.push(value);
      return (actual.cancelAnimation as (value: unknown) => void)(value);
    },
  };
});

const wrap = (node: ReactNode) => <HeroUINativeProvider>{node}</HeroUINativeProvider>;
const spinners = (): number => screen.UNSAFE_queryAllByType(Spinner).length;
const at = (running: number): StepStatus[] => Array.from({ length: 6 }, (_, index) => (index < running ? 'done' : index === running ? 'running' : 'pending'));
const SECONDS = [null, null, null, null, null, null];

beforeEach(() => {
  mockCancelled.length = 0;
});
afterEach(() => resetMotionStateForTests());

describe('G89-02 (B9): a hand-over copy of the pipeline owns no Reanimated indicator', () => {
  it('a still pipeline mounts no kit Spinner for its running step, and every step change and the unmount cancel no animation', () => {
    const view = render(wrap(<FinalizationPipeline statuses={at(0)} seconds={SECONDS} animate={false} />));
    expect(spinners()).toBe(0);
    // The running step still shows a sign that it runs.
    expect(screen.getByTestId('finalizing-pipeline-badge-0-running', { includeHiddenElements: true })).toBeTruthy();
    for (let step = 1; step <= 6; step += 1) {
      view.rerender(wrap(<FinalizationPipeline statuses={at(step)} seconds={SECONDS} animate={false} />));
      expect(spinners()).toBe(0);
    }
    view.unmount();
    expect(mockCancelled).toHaveLength(0);
  });

  it('CONTROL - an animated pipeline (no hand-over) keeps the kit Spinner, whose removal does cancel its animation', () => {
    const view = render(wrap(<FinalizationPipeline statuses={at(0)} seconds={SECONDS} animate />));
    expect(spinners()).toBe(1);
    view.rerender(wrap(<FinalizationPipeline statuses={at(1)} seconds={SECONDS} animate />));
    expect(mockCancelled.length).toBeGreaterThan(0);
    view.unmount();
  });
});

describe('G89-02 (B9): the Finalizing route after a hand-over, from STOPPING to SEALED', () => {
  it('no kit Spinner is ever mounted - neither on the status line nor in the pipeline - and no animation is mockCancelled on the way', async () => {
    const h = renderFlowApp({ scenario: 'finalizing', routeSync: false });
    // The route's copy that follows the monitor's in-place copy: marked as a hand-over before it mounts.
    h.app.unmount();
    mockCancelled.length = 0;
    markFinalizingHandover(h.sessionId);
    const again = renderFlowApp({ scenario: 'finalizing', routeSync: false });
    markFinalizingHandover(again.sessionId);
    await settle();
    let seen = spinners();
    for (let elapsed = 0; elapsed < 12_000 && again.sim.store.getState().session?.state !== 'SEALED'; elapsed += 200) {
      act(() => again.advance(200));
      seen += spinners();
    }
    expect(again.sim.store.getState().session?.state).toBe('SEALED');
    expect(seen).toBe(0);
    expect(mockCancelled).toHaveLength(0);
  });
});
