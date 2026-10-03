/**
 * C-4 Stepper maths (04_mobile_specs §4.0, §4.4, §4.6; 03_motion_spec M-C-09): step statuses,
 * connector fills, tones, accessibility labels and the enter stagger. Pure.
 */
import { motion } from '@dems/shared/tokens';

export type StepStatus = 'pending' | 'active' | 'running' | 'done' | 'warn' | 'error';
export type StepTone = 'accent' | 'default' | 'success' | 'warning' | 'danger';

export interface StepDef {
  key: string;
  label: string;
  description?: string;
}

/** Connector fill (03M M-C-09: `scaleX 0 → 1`, 420 ms `luxe`). */
export const CONNECTOR_FILL_MS = motion.duration.slow;
/** Check draw on completion (03M M-C-09: 300 ms). */
export const CHECK_DRAW_MS = 300;
/** Escalation or activation halo: one pulse (03M R8). */
export const HALO_PULSE_MS = 600;
/** R1 stagger cap. */
export const STAGGER_CAP = 8;

/**
 * Wizard statuses from the current index: before it done, at it active, after it pending. An index
 * past the end marks every step done. `overrides` sets individual steps (pipeline results, warnings).
 */
export function deriveStatuses(
  count: number,
  current: number,
  overrides: Readonly<Record<number, StepStatus>> = {},
): StepStatus[] {
  return Array.from({ length: count }, (_, i) => {
    const override = overrides[i];
    if (override) return override;
    if (i < current) return 'done';
    if (i === current) return 'active';
    return 'pending';
  });
}

/** Share of the connector after step `i` that is filled: 1 once the step is done, half while it is under way. */
export function connectorFill(status: StepStatus): number {
  if (status === 'done') return 1;
  if (status === 'active' || status === 'running') return 0.5;
  return 0;
}

/** Lead-in line before the first badge (horizontal wizard, as MB 3 draws it). */
export function leadFilled(first: StepStatus | undefined): boolean {
  return first !== undefined && first !== 'pending';
}

export function stepTone(status: StepStatus): StepTone {
  switch (status) {
    case 'active':
    case 'running':
    case 'done':
      return 'accent';
    case 'warn':
      return 'warning';
    case 'error':
      return 'danger';
    default:
      return 'default';
  }
}

export interface StepStatusWords {
  step: string;
  of: string;
  pending: string;
  active: string;
  running: string;
  done: string;
  warn: string;
  error: string;
}

export const DEFAULT_STATUS_WORDS: StepStatusWords = {
  step: 'Step',
  of: 'of',
  pending: 'not started',
  active: 'current',
  running: 'in progress',
  done: 'completed',
  warn: 'needs attention',
  error: 'failed',
};

/** "Step 2 of 3, Devices Check, current". */
export function stepA11yLabel(
  index: number,
  count: number,
  label: string,
  status: StepStatus,
  words: StepStatusWords = DEFAULT_STATUS_WORDS,
): string {
  return `${words.step} ${index + 1} ${words.of} ${count}, ${label}, ${words[status]}`;
}

export function progressFraction(statuses: readonly StepStatus[]): number {
  if (statuses.length === 0) return 0;
  return statuses.filter((s) => s === 'done').length / statuses.length;
}

/** R1 enter delay: `delayChildren` + i × `stagger`, items past the cap enter with the 8th. */
export function staggerDelay(index: number, stagger: number = motion.choreography.stagger): number {
  return motion.choreography.delayChildren + Math.min(index, STAGGER_CAP - 1) * stagger;
}
