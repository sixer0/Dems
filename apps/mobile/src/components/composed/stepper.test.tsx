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
