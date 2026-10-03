/**
 * Session Summary data and the acknowledgement (04_mobile_specs §4.7, §5.6; SCR-02; D61; D73 F74-13).
 *
 * Selectors return primitives or the store's own references (the tracks array, the steps array), so
 * `useSim`'s shallow compare keeps the screen quiet while the simulator ticks audio at 20 Hz.
 * `acknowledgeSummary` runs at most once per screen (SCR-02) and a refusal is shown and written to
 * the persistent runtime log (`dems.mobile.log.v1`), never swallowed.
 * Every function that calls a hook is named `use*` (D66: the device build runs the React Compiler).
 */
import { useToast } from 'heroui-native';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TimeSource } from '@dems/shared/domain';
import {
  selectEvidenceBySessionId,
  selectOperatorById,
  selectPendingSummaryId,
  selectSessionHistoryById,
  useSim,
  useSimInstance,
  type EvidenceTrack,
  type FaultKind,
  type FinalizationStepState,
  type SessionOutcome,
  type SubjectType,
} from '@dems/shared/sim';
import { reportRuntimeIssue } from '@/runtime';
import { timeSourceAt } from './sim-adapter';

/** The finished session (history entry) and where the route stands, as flat values. */
export interface SummarySession {
  readonly found: boolean;
  readonly activeId: string | null;
  readonly activeState: string | null;
  readonly outcome: SessionOutcome | null;
  readonly caseNumber: string | null;
  readonly subjectName: string | null;
  readonly subjectType: SubjectType | null;
  readonly investigatorName: string | null;
  readonly room: string | null;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
  readonly durationMs: number;
  readonly sizeBytes: number;
  readonly faultKind: FaultKind | null;
  /** SCR-02: this is the last sealed session and its summary is not acknowledged yet. */
  readonly pending: boolean;
  readonly startSource: TimeSource | null;
  readonly endSource: TimeSource | null;
}

export function useSummarySession(sessionId: string): SummarySession {
  return useSim((s) => {
    const entry = selectSessionHistoryById(s, sessionId);
    return {
      found: entry !== null,
      activeId: s.session?.id ?? null,
      activeState: s.session?.state ?? null,
      outcome: entry?.outcome ?? null,
      caseNumber: entry?.caseNumber ?? null,
      subjectName: entry?.subjectName ?? null,
      subjectType: entry?.subjectType ?? null,
      investigatorName: entry ? (selectOperatorById(s, entry.investigatorId)?.displayName ?? entry.investigatorId) : null,
      room: entry?.room ?? null,
      startedAt: entry?.startedAt ?? null,
      endedAt: entry?.endedAt ?? null,
      durationMs: entry?.durationMs ?? 0,
      sizeBytes: entry?.sizeBytes ?? 0,
      faultKind: entry?.faultKind ?? null,
      pending: selectPendingSummaryId(s) === sessionId,
      startSource: timeSourceAt(s.time.history, entry?.startedAt ?? null),
      endSource: timeSourceAt(s.time.history, entry?.endedAt ?? null),
    };
  });
}

/** The sealed evidence item of the session (book §11.3 fields), or null. */
export interface SummaryEvidence {
  readonly id: string;
  readonly manifestHash: string;
  readonly signatureValue: string;
  readonly signatureKeyId: string;
  readonly lifecycleStage: string;
  readonly sealedAt: number | null;
  readonly tracks: readonly EvidenceTrack[];
}

export function useSummaryEvidence(sessionId: string): SummaryEvidence | null {
  return useSim((s) => {
    const item = selectEvidenceBySessionId(s, sessionId);
    if (!item) return null;
    return {
      id: item.id,
      manifestHash: item.manifestHash,
      signatureValue: item.signature.value,
      signatureKeyId: item.signature.keyId,
      lifecycleStage: item.lifecycleStage,
      sealedAt: item.sealedAt,
      tracks: item.tracks,
    };
  });
}

/** The finished pipeline, kept only while this is still the simulator's current session. */
export interface SummaryFinalization {
  readonly steps: readonly FinalizationStepState[];
  readonly stoppedAt: number | null;
  readonly sealedAt: number | null;
}

export function useSummaryFinalization(sessionId: string): SummaryFinalization | null {
  return useSim((s) => {
    const session = s.session;
    if (!session || session.id !== sessionId || session.finalization.startedAt === null) return null;
    return { steps: session.finalization.steps, stoppedAt: session.stoppedAt, sealedAt: session.sealedAt };
  });
}

/**
 * SCR-02: acknowledges this summary once. Returns true when the summary is (now or already)
 * acknowledged or needs none (a past session), false when the simulator refused.
 */
export function useAcknowledgeSummary(sessionId: string): () => boolean {
  const sim = useSimInstance();
  const { toast } = useToast();
  const { t } = useTranslation();
  const done = useRef(false);
  return useCallback(() => {
    if (done.current) return true;
    if (selectPendingSummaryId(sim.store.getState()) !== sessionId) {
      done.current = true;
      return true;
    }
    try {
      sim.actions.acknowledgeSummary(sessionId);
      done.current = true;
      return true;
    } catch (error) {
      toast.show({ variant: 'danger', label: t('features.session-summary.actions.failed') });
      reportRuntimeIssue('error', 'features.sessionSummary.acknowledge', error, { sessionId });
      return false;
    }
  }, [sim, sessionId, toast, t]);
}
