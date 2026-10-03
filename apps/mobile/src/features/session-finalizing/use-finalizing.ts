/**
 * Finalization data (04_mobile_specs §4.6, §5.6; D61 session-action contract; D73 F74-13).
 *
 * Selectors return primitives or the store's own slice references, so `useSim`'s shallow compare
 * keeps the screen quiet while the simulator ticks audio at 20 Hz: it re-renders when a step
 * resolves or the state changes, not per frame. Time-based values read the simulator clock (F74-09).
 * Every function that calls a hook is named `use*` (D66: the device build runs the React Compiler).
 */
import type { SessionState } from '@dems/shared/domain';
import { useSim, type FinalizationStepState, type FaultKind, type SubjectType } from '@dems/shared/sim';
import { handOffDue } from './finalizing.model';

/** The session being finalized, as flat values. */
export interface FinalizingSession {
  readonly id: string | null;
  readonly state: SessionState | null;
  readonly caseNumber: string | null;
  readonly subjectName: string | null;
  readonly subjectType: SubjectType | null;
  readonly startedAt: number | null;
  readonly stoppedAt: number | null;
  readonly sealedAt: number | null;
  readonly evidenceId: string | null;
  readonly faultKind: FaultKind | null;
  /** SCR-02: this session's summary still waits for `acknowledgeSummary`. */
  readonly summaryPending: boolean;
}

export function useFinalizingSession(): FinalizingSession {
  return useSim((s) => {
    const session = s.session;
    return {
      id: session?.id ?? null,
      state: session?.state ?? null,
      caseNumber: session?.input.caseNumber ?? null,
      subjectName: session?.input.subjectName ?? null,
      subjectType: session?.input.subjectType ?? null,
      startedAt: session?.startedAt ?? null,
      stoppedAt: session?.stoppedAt ?? null,
      sealedAt: session?.sealedAt ?? null,
      evidenceId: session?.evidenceId ?? null,
      faultKind: session?.fault?.kind ?? null,
      summaryPending: session !== null && s.lastSealedSessionId === session.id && !s.lastSealedAcknowledged,
    };
  });
}

/** The six steps of the current session (the store's own array; null before FINALIZING). */
export function useFinalizationSteps(): readonly FinalizationStepState[] | null {
  return useSim((s) => (s.session && s.session.finalization.startedAt !== null ? s.session.finalization.steps : null));
}

/** True once the 1.2 s SEALED beat has passed on the simulator clock (flips once). */
export function useSealedHandOffDue(sealedAt: number | null): boolean {
  return useSim((s) => handOffDue(sealedAt, s.clock.now));
}
