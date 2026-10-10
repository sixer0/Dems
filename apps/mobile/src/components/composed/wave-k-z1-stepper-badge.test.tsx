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
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen } from '@testing-library/react-native';
import { HeroUINativeProvider } from 'heroui-native';
import type { ReactNode } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { Stepper } from './stepper';
import type { StepStatus } from './stepper.math';

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
