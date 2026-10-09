/**
 * Finalization maths (04_mobile_specs §4.6; 03_motion_spec M-C-09). Pure: no React, no simulator
 * instance. The screens read the simulator through `use-finalizing.ts` and turn it into these
 * values; the tests check them directly.
 */
import { FINALIZATION_STEPS_V2, FinalizationStep, type SessionState } from '@dems/shared/domain';
import type { FinalizationStepState } from '@dems/shared/sim';
import type { StepStatus } from '@/components/composed/stepper';

/**
 * The six §12.2 steps in pipeline order. SH-01 (row 47) renamed FINALIZE_TRACKS→CLOSE_TRACKS and
 * CALCULATE_HASHES→FINALIZE_HASHES and inserted FINALIZE_TRANSCRIPT (ENCRYPT_PAYLOAD became
 * fallback-only), so the client mirrors the single shared source `FINALIZATION_STEPS_V2` — which is
 * also what the simulator emits as its finalization order — rather than restating the names here.
 */
export const FINALIZATION_STEPS: readonly FinalizationStep[] = FINALIZATION_STEPS_V2;

/** 04 §4.6: "After 1.2 s, route-sync opens the Summary" (measured on the simulator clock). */
export const SEALED_HANDOFF_MS = 1_200;

/**
 * What the Finalization screen shows for a session state:
 * - `stopping`: STOPPING (tracks closing, 1.5 s), every step still waiting;
 * - `finalizing`: FINALIZING, steps resolving one by one;
 * - `sealed`: SEALED, the stamp;
 * - `interrupted`: FAULT or RECOVERY (a critical fault stopped the pipeline, P7: calm, no loop);
 * - `open`: CREATE … RECORDING (the session has not ended; reachable only by a deep link);
 * - `idle`: no session.
 */
export type FinalizingPhase = 'idle' | 'open' | 'stopping' | 'finalizing' | 'sealed' | 'interrupted';

export function finalizingPhase(state: SessionState | null): FinalizingPhase {
  switch (state) {
    case null:
      return 'idle';
    case 'STOPPING':
      return 'stopping';
    case 'FINALIZING':
      return 'finalizing';
    case 'SEALED':
      return 'sealed';
    case 'FAULT':
    case 'RECOVERY':
      return 'interrupted';
    default:
      return 'open';
  }
}

/** Back is blocked while the pipeline runs (04 §3.6: STOPPING, FINALIZING → toast, no dialog). */
export function isFinalizingBusy(phase: FinalizingPhase): boolean {
  return phase === 'stopping' || phase === 'finalizing';
}

/**
 * Stepper statuses for the six steps. The simulator's `active` step shows as `running` (a Spinner,
 * 04 §4.6 "Each step shows Spinner → check"); once the session is SEALED every step is done; when a
 * fault interrupted the pipeline, the step that was running turns `error` (one halo pulse, then a
 * steady colour: 03M P7). A missing slice (STOPPING before the steps exist) reads as all waiting.
 */
export function pipelineStatuses(steps: readonly FinalizationStepState[] | null, phase: FinalizingPhase): StepStatus[] {
  return FINALIZATION_STEPS.map((id) => {
    if (phase === 'sealed') return 'done';
    const step = steps?.find((candidate) => candidate.id === id);
    if (!step) return 'pending';
    switch (step.status) {
      case 'done':
        return 'done';
      case 'active':
        return phase === 'interrupted' ? 'error' : 'running';
      case 'warn':
        return 'warn';
      case 'error':
        return 'error';
      default:
        return 'pending';
    }
  });
}

/** Whole percent of the pipeline done (0 … 100). */
export function pipelinePercent(statuses: readonly StepStatus[]): number {
  if (statuses.length === 0) return 0;
  return Math.round((statuses.filter((status) => status === 'done').length / statuses.length) * 100);
}

/** Seconds a finished step took, one decimal ("0.8"), or null while it runs or waits. */
export function stepSeconds(step: Pick<FinalizationStepState, 'startedAt' | 'completedAt'> | undefined): string | null {
  if (!step || step.startedAt === null || step.completedAt === null) return null;
  return (Math.max(0, step.completedAt - step.startedAt) / 1_000).toFixed(1);
}

/** Per-step durations in pipeline order (null for steps that have not finished). */
export function pipelineSeconds(steps: readonly FinalizationStepState[] | null): (string | null)[] {
  return FINALIZATION_STEPS.map((id) => stepSeconds(steps?.find((candidate) => candidate.id === id)));
}

/** Seconds from End Session to SEALED, one decimal ("8.7"), or null before the seal. */
export function sealedAfterSeconds(stoppedAt: number | null, sealedAt: number | null): string | null {
  if (stoppedAt === null || sealedAt === null) return null;
  return (Math.max(0, sealedAt - stoppedAt) / 1_000).toFixed(1);
}

/** Whether the 1.2 s SEALED beat is over at simulator time `now`. */
export function handOffDue(sealedAt: number | null, now: number): boolean {
  return sealedAt !== null && now - sealedAt >= SEALED_HANDOFF_MS;
}
