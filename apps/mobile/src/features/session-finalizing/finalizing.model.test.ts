// Finalization maths (step 80; 04_mobile_specs §4.6, §3.6; 03M M-C-09).
import { describe, expect, it } from '@jest/globals';
import type { FinalizationStepState } from '@dems/shared/sim';
import {
  FINALIZATION_STEPS,
  SEALED_HANDOFF_MS,
  finalizingPhase,
  handOffDue,
  isFinalizingBusy,
  pipelinePercent,
  pipelineSeconds,
  pipelineStatuses,
  sealedAfterSeconds,
  stepSeconds,
} from './finalizing.model';

function steps(statuses: FinalizationStepState['status'][]): FinalizationStepState[] {
  return FINALIZATION_STEPS.map((id, i) => ({
    id,
    status: statuses[i] ?? 'pending',
    startedAt: statuses[i] === 'pending' ? null : 1_000 * i,
    completedAt: statuses[i] === 'done' ? 1_000 * i + 800 : null,
    durationMs: 800,
  }));
}

describe('finalizingPhase / isFinalizingBusy', () => {
  it('maps every session state', () => {
    expect(finalizingPhase(null)).toBe('idle');
    expect(finalizingPhase('STOPPING')).toBe('stopping');
    expect(finalizingPhase('FINALIZING')).toBe('finalizing');
    expect(finalizingPhase('SEALED')).toBe('sealed');
    expect(finalizingPhase('FAULT')).toBe('interrupted');
    expect(finalizingPhase('RECOVERY')).toBe('interrupted');
    for (const open of ['CREATE', 'PRECHECK', 'ARMED', 'RECORDING'] as const) expect(finalizingPhase(open)).toBe('open');
  });

  it('blocks Back only while STOPPING or FINALIZING (§3.6)', () => {
    expect(isFinalizingBusy('stopping')).toBe(true);
    expect(isFinalizingBusy('finalizing')).toBe(true);
    for (const phase of ['idle', 'open', 'sealed', 'interrupted'] as const) expect(isFinalizingBusy(phase)).toBe(false);
  });
});

describe('pipelineStatuses', () => {
  it('shows the active step as running (Spinner) and the rest as they are', () => {
    expect(pipelineStatuses(steps(['done', 'active']), 'finalizing')).toEqual(['done', 'running', 'pending', 'pending', 'pending', 'pending']);
  });
  it('waits on every step before the slice exists (STOPPING)', () => {
    expect(pipelineStatuses(null, 'stopping')).toEqual(Array(6).fill('pending'));
  });
  it('marks all done once SEALED', () => {
    expect(pipelineStatuses(steps(['done', 'done', 'active']), 'sealed')).toEqual(Array(6).fill('done'));
  });
  it('turns the interrupted step into an error (P7)', () => {
    expect(pipelineStatuses(steps(['done', 'done', 'active']), 'interrupted')).toEqual(['done', 'done', 'error', 'pending', 'pending', 'pending']);
  });
});

describe('progress and durations', () => {
  it('percent of steps done', () => {
    expect(pipelinePercent(Array(6).fill('pending'))).toBe(0);
    expect(pipelinePercent(['done', 'running', 'pending', 'pending', 'pending', 'pending'])).toBe(17);
    expect(pipelinePercent(Array(6).fill('done'))).toBe(100);
    expect(pipelinePercent([])).toBe(0);
  });
  it('step seconds only for finished steps', () => {
    expect(stepSeconds({ startedAt: 1_000, completedAt: 1_860 })).toBe('0.9');
    expect(stepSeconds({ startedAt: 1_000, completedAt: null })).toBeNull();
    expect(stepSeconds(undefined)).toBeNull();
    expect(pipelineSeconds(steps(['done', 'active']))).toEqual(['0.8', null, null, null, null, null]);
  });
  it('sealed-after seconds and the 1.2 s hand-off on the simulator clock', () => {
    expect(sealedAfterSeconds(10_000, 18_700)).toBe('8.7');
    expect(sealedAfterSeconds(null, 18_700)).toBeNull();
    expect(handOffDue(null, 99_999)).toBe(false);
    expect(handOffDue(5_000, 5_000 + SEALED_HANDOFF_MS - 1)).toBe(false);
    expect(handOffDue(5_000, 5_000 + SEALED_HANDOFF_MS)).toBe(true);
  });
});
