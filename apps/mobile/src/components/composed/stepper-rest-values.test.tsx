// Post-review fix FXR-M, finding W93-7 (code review W93, decision D243; routed by CF2-A, D236).
//
// The Stepper's rest values lived ONLY in shared values: the connector fill (`scaleX`/`scaleY`), the glow
// ring's opacity and the check's `strokeDashoffset`. CF2-A mapped the "Unable to find SurfaceMountingManager"
// bursts to these views in the in-place Finalizing copy (mounted and removed within ~0.5 s), and a lost final
// value leaves a half-filled connector or a missing check (the RF-PH-4 class). The fix is the FX-M2b pattern:
// React holds each rest value; the motion is an overlay React removes after its budget; `animate={false}`
// starts no motion. Modelled here under the worst case of the device's dropped updates: every
// `useAnimatedStyle` keeps its first style and every `useAnimatedProps` its first props.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import type { ReactNode } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import type { ReactTestInstance } from 'react-test-renderer';
import { Stepper, STEPPER_OVERLAY_SLACK_MS } from './stepper';
import { CHECK_DRAW_MS, CONNECTOR_FILL_MS, HALO_PULSE_MS, type StepStatus } from './stepper.math';

jest.mock('react-native-reanimated', () => {
  const actual = jest.requireActual<Record<string, unknown>>('react-native-reanimated');
  const React = jest.requireActual<typeof import('react')>('react');
  // Hook-named so the rules of hooks hold: it keeps the first value its updater gave, forever.
  const useFirstOnly = (updater: () => Record<string, unknown>) => {
    const first = React.useRef<Record<string, unknown> | null>(null);
    if (first.current === null) first.current = updater();
    return first.current;
  };
  return { __esModule: true, ...actual, useAnimatedStyle: useFirstOnly, useAnimatedProps: useFirstOnly };
});

const wrap = (node: ReactNode) => <HeroUINativeProvider>{node}</HeroUINativeProvider>;
const STEPS = [
  { key: 'close', label: 'Close tracks' },
  { key: 'hash', label: 'Hash tracks' },
  { key: 'seal', label: 'Seal' },
] as const;
const ALL_BUDGETS = Math.max(CONNECTOR_FILL_MS, CHECK_DRAW_MS, HALO_PULSE_MS) + STEPPER_OVERLAY_SLACK_MS + 50;

const host = (testID: string): ReactTestInstance =>
  screen.getAllByTestId(testID, { includeHiddenElements: true }).filter((n) => typeof (n.type as unknown) === 'string')[0]!;
const hasHost = (testID: string): boolean =>
  screen.queryAllByTestId(testID, { includeHiddenElements: true }).some((n) => typeof (n.type as unknown) === 'string');
const flat = (testID: string): ViewStyle => (StyleSheet.flatten(host(testID).props.style) ?? {}) as ViewStyle;
const scaleOf = (testID: string): number => {
  const transform = (flat(testID).transform ?? []) as unknown as readonly Record<string, number>[];
  return transform.reduce((v, t) => v * (t.scaleX ?? t.scaleY ?? 1), 1);
};

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  cleanup();
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

function pipeline(statuses: readonly StepStatus[], animate = true) {
  return wrap(<Stepper testID="p" steps={STEPS} statuses={statuses} orientation="vertical" motion="full" animate={animate} />);
}

describe('W93-7: React holds the Stepper rest values (every animation update lost)', () => {
  it('step 1 done, step 2 running: after the budgets the connector is full, the check drawn, the ring on step 2 only', () => {
    const { rerender } = render(pipeline(['running', 'pending', 'pending']));
    expect(scaleOf('p-fill-0')).toBe(0);
    expect(flat('p-badge-0-ring').opacity).toBe(1);
    rerender(pipeline(['done', 'running', 'pending']));
    act(() => {
      jest.advanceTimersByTime(ALL_BUDGETS);
    });
    expect(scaleOf('p-fill-0')).toBe(1);
    expect(scaleOf('p-fill-1')).toBe(0);
    expect(hasHost('p-badge-0-check')).toBe(true);
    expect(host('p-badge-0-check').props.strokeDashoffset ?? 0).toBe(0);
    expect(flat('p-badge-0-ring').opacity).toBe(0);
    expect(flat('p-badge-1-ring').opacity).toBe(1);
    // Every overlay is gone: nothing is left for a dropped update to freeze.
    for (const id of ['p-fill-0-motion', 'p-badge-0-ring-motion', 'p-badge-1-ring-motion', 'p-badge-1-halo-motion']) expect([id, hasHost(id)]).toEqual([id, false]);
  });

  it('a step that is no longer done empties its connector after the budget (the overlay frozen at full is removed)', () => {
    const { rerender } = render(pipeline(['done', 'done', 'running']));
    expect(scaleOf('p-fill-1')).toBe(1);
    rerender(pipeline(['done', 'error', 'pending']));
    act(() => {
      jest.advanceTimersByTime(ALL_BUDGETS);
    });
    expect(scaleOf('p-fill-1')).toBe(0);
    expect(hasHost('p-fill-1-motion')).toBe(false);
  });

  it('the wizard (horizontal): the left half of step 2 fills once step 1 is done', () => {
    const steps = [
      { key: 'info', label: 'Session Info' },
      { key: 'check', label: 'Devices Check' },
    ] as const;
    const { rerender } = render(wrap(<Stepper testID="w" steps={steps} current={0} motion="full" />));
    expect(scaleOf('w-fill-left-1')).toBe(0);
    rerender(wrap(<Stepper testID="w" steps={steps} current={1} motion="full" />));
    act(() => {
      jest.advanceTimersByTime(ALL_BUDGETS);
    });
    expect(scaleOf('w-fill-left-1')).toBe(1);
    expect(scaleOf('w-fill-right-0')).toBe(1);
  });

  it('animate={false} (the in-place hand-over copy): a change starts no overlay and draws the final state at once', () => {
    const { rerender } = render(pipeline(['running', 'pending', 'pending'], false));
    rerender(pipeline(['done', 'running', 'pending'], false));
    for (const id of ['p-fill-0-motion', 'p-badge-0-ring-motion', 'p-badge-1-ring-motion', 'p-badge-1-halo-motion']) expect([id, hasHost(id)]).toEqual([id, false]);
    expect(scaleOf('p-fill-0')).toBe(1);
    expect(hasHost('p-badge-0-check')).toBe(true);
    expect(flat('p-badge-1-ring').opacity).toBe(1);
  });

  it('with motion, the change IS played as an overlay while its budget runs (the motion is kept, only made removable)', () => {
    const { rerender } = render(pipeline(['running', 'pending', 'pending']));
    rerender(pipeline(['done', 'running', 'pending']));
    expect(hasHost('p-fill-0-motion')).toBe(true);
    expect(scaleOf('p-fill-0')).toBe(0); // the React-held fill is hidden while the overlay plays
    expect(hasHost('p-badge-1-halo-motion')).toBe(true);
  });
});
