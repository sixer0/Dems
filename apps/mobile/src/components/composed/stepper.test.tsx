// C-4 Stepper: status derivation, connector fills, labels, and the wizard / pipeline render.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import type { ReactNode } from 'react';
import { Stepper } from './stepper';
import {
  connectorFill,
  deriveStatuses,
  leadFilled,
  progressFraction,
  staggerDelay,
  stepA11yLabel,
  stepTone,
} from './stepper.math';
import type { ReactTestInstance } from 'react-test-renderer';
import type { StepStatus } from './stepper.math';
import { unmountBeforeTheHooksOfThisGroup } from '@/runtime/testing/scoped-cleanup';

const WIZARD = [
  { key: 'info', label: 'Session Info' },
  { key: 'check', label: 'Devices Check' },
  { key: 'ready', label: 'Ready' },
] as const;

describe('Stepper maths', () => {
  it('derives wizard statuses from the current index, with overrides', () => {
    expect(deriveStatuses(3, 0)).toEqual(['active', 'pending', 'pending']);
    expect(deriveStatuses(3, 2)).toEqual(['done', 'done', 'active']);
    expect(deriveStatuses(3, 3)).toEqual(['done', 'done', 'done']);
    expect(deriveStatuses(3, 1, { 1: 'warn' })).toEqual(['done', 'warn', 'pending']);
  });

  it('fills the connector half-way while a step runs and fully once it is done (MB 3)', () => {
    expect(connectorFill('pending')).toBe(0);
    expect(connectorFill('active')).toBe(0.5);
    expect(connectorFill('running')).toBe(0.5);
    expect(connectorFill('done')).toBe(1);
    expect(leadFilled('active')).toBe(true);
    expect(leadFilled('pending')).toBe(false);
  });

  it('maps statuses to tones and accessible labels', () => {
    expect(stepTone('active')).toBe('accent');
    expect(stepTone('warn')).toBe('warning');
    expect(stepTone('error')).toBe('danger');
    expect(stepTone('pending')).toBe('default');
    expect(stepA11yLabel(1, 3, 'Devices Check', 'active')).toBe('Step 2 of 3, Devices Check, current');
    expect(progressFraction(['done', 'done', 'active', 'pending'])).toBe(0.5);
  });

  it('staggers entries 60 ms apart after 80 ms, capped at 8 items', () => {
    expect(staggerDelay(0)).toBe(80);
    expect(staggerDelay(2)).toBe(200);
    expect(staggerDelay(20)).toBe(staggerDelay(7));
  });
});

describe('Stepper component', () => {
  const wrap = (node: ReactNode) => <HeroUINativeProvider>{node}</HeroUINativeProvider>;

  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    // Unmount and flush queued UI-runtime work under this test's fake clock (frame callbacks
    // register and unregister through it), then return to real timers.
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders the MB 3 wizard with the current step announced', () => {
    render(wrap(<Stepper steps={WIZARD} current={0} motion="reduced" testID="wiz" />));
    expect(screen.getByText('Session Info')).toBeTruthy();
    expect(screen.getByText('1', { includeHiddenElements: true })).toBeTruthy(); // badge digits are decorative for TalkBack
    expect(screen.getByLabelText('Step 1 of 3, Session Info, current')).toBeTruthy();
    expect(screen.getByLabelText('Step 3 of 3, Ready, not started')).toBeTruthy();
  });

  it('advances and lets the operator go back to a completed step', () => {
    const onStepPress = jest.fn();
    const { rerender } = render(wrap(<Stepper steps={WIZARD} current={0} motion="full" testID="wiz" />));
    rerender(wrap(<Stepper steps={WIZARD} current={1} motion="full" testID="wiz" onStepPress={onStepPress} />));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByLabelText('Step 1 of 3, Session Info, completed')).toBeTruthy();
    expect(screen.getByLabelText('Step 2 of 3, Devices Check, current')).toBeTruthy();
    fireEvent.press(screen.getByTestId('wiz-step-0'));
    expect(onStepPress).toHaveBeenCalledWith(0);
  });

  // Fix wave J round two (JA2-22 / JT-13): a completed step that a press does not open is text, not a button.
  it.each(['horizontal', 'vertical'] as const)('JA2-22 (%s): only the steps `canPressStep` allows are buttons; the others are text and take no press', (orientation) => {
    const onStepPress = jest.fn();
    render(wrap(<Stepper steps={WIZARD} current={2} orientation={orientation} motion="reduced" testID="wiz" onStepPress={onStepPress} canPressStep={(index) => index === 1} />));
    const info = screen.getByLabelText('Step 1 of 3, Session Info, completed');
    const checks = screen.getByLabelText('Step 2 of 3, Devices Check, completed');
    expect(info.props.accessibilityRole).toBe('text');
    expect(info.props.accessibilityState).toMatchObject({ disabled: true });
    expect(checks.props.accessibilityRole).toBe('button');
    fireEvent.press(info);
    expect(onStepPress).not.toHaveBeenCalled();
    fireEvent.press(checks);
    expect(onStepPress).toHaveBeenCalledWith(1);
  });

  // Fix wave J round two (JA2-20): six labels do not fit a phone's columns ("Authoriz-e", "Destinati-on").
  it('JA2-20: `labels="current"` draws ONE label under the badges; every step keeps its accessible name', () => {
    const SIX = ['Authorize', 'Verify source', 'Options', 'Destination', 'Reason', 'Result'].map((label, index) => ({ key: `s${index}`, label }));
    render(wrap(<Stepper steps={SIX} current={3} labels="current" motion="reduced" testID="exp" />));
    // Decorative for a screen reader (each step has its own name), so it is read with the hidden elements.
    expect(screen.getByTestId('exp-current-label', { includeHiddenElements: true })).toHaveTextContent('Step 4 of 6 · Destination');
    // The words are drawn once: no visible label of another step.
    expect(screen.queryByText('Authorize')).toBeNull();
    expect(screen.queryByText('Result')).toBeNull();
    expect(screen.getByLabelText('Step 1 of 6, Authorize, completed')).toBeTruthy();
    expect(screen.getByLabelText('Step 6 of 6, Result, not started')).toBeTruthy();
  });

  it('JA2-20 CONTROL: the default draws every label', () => {
    render(wrap(<Stepper steps={WIZARD} current={1} motion="reduced" testID="wiz" />));
    expect(screen.queryByTestId('wiz-current-label')).toBeNull();
    expect(screen.getByText('Session Info')).toBeTruthy();
    expect(screen.getByText('Ready')).toBeTruthy();
  });

  it('renders a vertical pipeline with running and failed steps', () => {
    render(
      wrap(
        <Stepper
          orientation="vertical"
          motion="reduced"
          steps={[
            { key: 'a', label: 'Close tracks' },
            { key: 'b', label: 'Hash tracks', description: 'SHA-256 per track' },
            { key: 'c', label: 'Seal' },
          ]}
          statuses={['done', 'running', 'error']}
        />,
      ),
    );
    expect(screen.getByLabelText('Step 2 of 3, Hash tracks, in progress')).toBeTruthy();
    expect(screen.getByText('SHA-256 per track')).toBeTruthy();
    expect(screen.getByLabelText('Step 3 of 3, Seal, failed')).toBeTruthy();
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────────
// Moved here from `wave-k-z1-stepper-badge.test.tsx` (test-suite consolidation, D233): every case as it was.
// Fix wave K Z1, G94b-13 ("the export sheet draws only the FIRST stepper badge as done").
//
// Seen on the tablet (implementation/145_fix_wave_k_z1.md, section G94b-13; export wizard of
// `EV-20261010-0022`, reduced motion, no export made): the view tree held the check glyph of the
// second badge at its place, the screen did not show it; the badge that had just become current
// showed no number either. Only the first badge - current from its mount - was drawn. So the state
// was right and the PAINT was missing: a kit Chip that was mounted as a pending badge and then
// changes its variant in place stops painting what is inside it. With the chip mounted anew when its
// look changes, every badge was drawn (same wizard, same steps).
//
// jsdom has no paint, so the rule held here is the one that cured the device: a badge whose look
// changes is ANOTHER chip (a new host view), and a badge whose look stays is the same one.
describe('the badge of a step whose look changes', () => {
unmountBeforeTheHooksOfThisGroup();
const wrap = (node: ReactNode) => <HeroUINativeProvider>{node}</HeroUINativeProvider>;
const STEPS = [
  { key: 'authorize', label: 'Authorize' },
  { key: 'verify', label: 'Verify source' },
  { key: 'destination', label: 'Destination' },
] as const;
const host = (testID: string): ReactTestInstance => screen.getAllByTestId(testID, { includeHiddenElements: true }).filter((node) => typeof (node.type as unknown) === 'string')[0]!;
const stepper = (statuses: readonly StepStatus[], motion: 'full' | 'reduced' = 'reduced') => wrap(<Stepper steps={STEPS} statuses={statuses} orientation="horizontal" motion={motion} testID="wizard" />);

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

describe.each(['reduced', 'full'] as const)('G94b-13 - a badge whose look changes is mounted anew (%s motion)', (motion) => {
  it('pending -> current -> done: each step of the second badge is a new chip, holding the number, then the check', () => {
    const view = render(stepper(['active', 'pending', 'pending'], motion));
    const pending = host('wizard-badge-1-chip');
    view.rerender(stepper(['done', 'active', 'pending'], motion));
    const current = host('wizard-badge-1-chip');
    expect(current).not.toBe(pending);
    expect(screen.getByText('2', { includeHiddenElements: true })).toBeTruthy();
    view.rerender(stepper(['done', 'done', 'active'], motion));
    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    const done = host('wizard-badge-1-chip');
    expect(done).not.toBe(current);
    expect(screen.getAllByTestId('wizard-badge-1-check', { includeHiddenElements: true }).length).toBeGreaterThan(0);
    expect(screen.queryByText('2', { includeHiddenElements: true })).toBeNull();
  });

  it('CONTROL: a badge whose look does not change keeps its chip (nothing is remounted on an unrelated render)', () => {
    const view = render(stepper(['active', 'pending', 'pending'], motion));
    const first = host('wizard-badge-0-chip');
    const third = host('wizard-badge-2-chip');
    view.rerender(stepper(['active', 'pending', 'pending'], motion));
    expect(host('wizard-badge-0-chip')).toBe(first);
    view.rerender(stepper(['done', 'active', 'pending'], motion));
    // The third badge is still pending: the same chip.
    expect(host('wizard-badge-2-chip')).toBe(third);
    // The first changed its look: another chip.
    expect(host('wizard-badge-0-chip')).not.toBe(first);
  });
});
});

// Fix wave J, JM-01 (the BLOCKER of the motion-on judging; reproduced on the tablet, normal launch, export
// wizard "Next": "[Worklets] Tried to synchronously call a Remote Function. Called "scaleFor" on the UI
// Runtime." with "Encountered two children with the same key, `1`").
//
// 1. The remote call: a plain function called from the fill overlay's `useAnimatedStyle`. Jest runs worklets on
//    the JS runtime, so the call itself cannot fail here; the guard of `jest.setup.ts`
//    (`@/motion/testing/worklet-closure`) reads what the Worklets plugin wrote on every worklet handed to
//    Reanimated and fails the test that mounted an offender. Without the fix the three full-motion cases below
//    fail with "useAnimatedStyle: stepperTsx1 calls scaleFor" - the name the device printed.
// 2. The keys: the ring fade and the halo pulse are siblings and both counted their runs from 1.
describe.each(['full', 'reduced'] as const)('JM-01 - a step change of the shared stepper (%s motion)', (motion) => {
  unmountBeforeTheHooksOfThisGroup();
  const wrap = (node: ReactNode) => <HeroUINativeProvider>{node}</HeroUINativeProvider>;
  const EXPORT = ['Authorize', 'Verify source', 'Destination', 'Reason', 'Build and hash', 'Done'].map((label, i) => ({ key: `s${i}`, label }));
  let errors: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    jest.useFakeTimers();
    errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    cleanup();
    act(() => {
      jest.runOnlyPendingTimers();
    });
    errors.mockRestore();
    jest.useRealTimers();
  });

  const keyWarnings = (): unknown[][] => errors.mock.calls.filter((call) => String(call[0]).includes('same key'));

  it.each(['horizontal', 'vertical'] as const)('%s: the wizard walks all six steps and React reports no two children with the same key', (orientation) => {
    const view = render(wrap(<Stepper steps={EXPORT} current={0} orientation={orientation} motion={motion} testID="x" />));
    for (let current = 1; current <= EXPORT.length; current += 1) {
      view.rerender(wrap(<Stepper steps={EXPORT} current={current} orientation={orientation} motion={motion} testID="x" />));
      // Half-way through the overlays' budgets, so ring, halo, check and fill overlays are all mounted together.
      act(() => {
        jest.advanceTimersByTime(120);
      });
    }
    expect(keyWarnings()).toEqual([]);
    act(() => {
      jest.advanceTimersByTime(2_000);
    });
    expect(keyWarnings()).toEqual([]);
    expect(screen.getByLabelText('Step 6 of 6, Done, completed')).toBeTruthy();
  });

  it(motion === 'full' ? 'the fill, ring and halo overlays ARE mounted for the change (so the worklet guard has read them)' : 'no overlay is mounted at all: the change is drawn by React', () => {
    const view = render(wrap(<Stepper steps={EXPORT} current={0} motion={motion} testID="x" />));
    view.rerender(wrap(<Stepper steps={EXPORT} current={1} motion={motion} testID="x" />));
    const mounted = (testID: string): boolean => screen.queryAllByTestId(testID, { includeHiddenElements: true }).length > 0;
    expect(mounted('x-fill-left-1-motion')).toBe(motion === 'full');
    expect(mounted('x-badge-1-ring-motion')).toBe(motion === 'full');
    expect(mounted('x-badge-1-halo-motion')).toBe(motion === 'full');
  });
});

