/**
 * Recovery Status data (04_mobile_specs §4.8, §5.6; D61 session-action contract; D73 F74-09, F74-13).
 *
 * Every selector returns primitives (or `null`), so `useSim`'s shallow compare keeps the screen quiet
 * while the simulator ticks audio at 20 Hz: it re-renders when the state, a finding or a pipeline
 * milestone changes (8 milestones in the 3 s recovery), not per frame. Time-based values read the
 * simulator clock (F74-09). Every function that calls a hook is named `use*` (D66).
 *
 * **Live mode** (backend task, plan row W73; 04_client_integration_spec §8.6 S2-3, §8.7 S4-8 and
 * S5-2; requirement E1 of 01_specs §8.6). The selectors read the Live source's replica, whose `clock`
 * follows the Core's clock (CL-12, §2.3), so the pipeline milestones follow the Core's own
 * `session.recovery` stage and times. The actions come from `useCoreActions()` and every result is
 * consumed through `settle` (CL-25): in Simulated mode the continuation runs before the call
 * returns, so the screen keeps its step-81 timing exactly; in Live mode it runs in the turn in which
 * the store holds the command's effect (CL-16).
 *
 * | Site | What | Live behaviour |
 * |------|------|----------------|
 * | S2-3 | `start` (`recover`, operation 33) | Reports `true` or `false` to its continuation instead of returning it; the screen's milestones follow the state |
 * | S4-8 | `acknowledgeAlerts` (`acknowledgeAlert`, operation 70, per matching alert) | One request per alert, fired without waiting for each other; a refusal is presented and logged, nothing waits for it |
 * | S5-2 | the role hint of `startRecovery` | Kept as the client-side hint (no request for a role the replica says lacks SESSION_START); the Core enforces SESSION_START |
 *
 * Every rejection goes to the refusal presenter first in Live mode (`useCoreErrorPresenter`, §6.2,
 * LB-5 to LB-10; mobile rule 2), and only what it leaves gets this screen's own toast; Simulated mode
 * keeps the step-81 toasts. The read-only refusal while the Core link is down stays first; whether
 * the screen is read-only is the runtime's one rule, `useCoreLinkReadOnly()` (row M2; shared with the
 * Session Monitor): in Live mode the notice of rows M0 and M1, otherwise the step-81 rule.
 */
import { useToast } from 'heroui-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SessionState } from '@dems/shared/domain';
import { settle, useCoreActions } from '@dems/shared/live';
import {
  SimPermissionError,
  SimTransitionError,
  selectRole,
  useSim,
  useSimInstance,
  type FaultKind,
  type OperatorRole,
  type SessionOutcome,
  type SimState,
  type SubjectType,
} from '@dems/shared/sim';
import { reportRuntimeIssue, useCoreErrorPresenter, useCoreLink, useCoreLinkReadOnly } from '@/runtime';
import {
  RECOVERY_TRACKS,
  ackSettled,
  recoveryMilestone,
  segmentFinding,
  timeFinding,
  trackFindings,
  type SegmentFinding,
  type TimeFinding,
  type TrackFinding,
  type TrackIntegrity,
} from './recovery.model';
import { assertCanViewEvidence, recoverySignatureOf, startRecovery } from './sim-adapter';

/** The followed session at the interruption, as flat values (D60, 2026-11-04: the six tracks spelt out). */
export interface RecoveryInputs {
  readonly id: string;
  readonly state: SessionState;
  readonly faultKind: FaultKind | null;
  readonly faultAt: number | null;
  readonly fromState: SessionState | null;
  readonly startedAt: number | null;
  readonly caseNumber: string;
  readonly subjectName: string;
  readonly subjectType: SubjectType;
  readonly room: string;
  readonly bytesWritten: number;
  readonly lastAutosaveAt: number | null;
  readonly video1: TrackIntegrity;
  readonly video1Since: number | null;
  readonly video2: TrackIntegrity;
  readonly video2Since: number | null;
  readonly video3: TrackIntegrity; // D60 (2026-11-04): four video tracks
  readonly video3Since: number | null; // D60
  readonly video4: TrackIntegrity; // D60
  readonly video4Since: number | null; // D60
  readonly audio1: TrackIntegrity;
  readonly audio1Since: number | null;
  readonly audio2: TrackIntegrity;
  readonly audio2Since: number | null;
  readonly timeTo: TimeFinding['to'];
  readonly timeAt: number | null;
}

/** Live inputs from the store (pure; exported for the tests). */
export function selectRecoveryInputs(s: SimState): RecoveryInputs | null {
  const session = s.session;
  if (!session) return null;
  const faultAt = session.fault?.at ?? null;
  const tracks = trackFindings(session.startedAt !== null, faultAt, s.faults.active);
  const time = timeFinding(faultAt, s.faults.active);
  let lastAutosaveAt: number | null = null;
  for (const item of session.timeline) {
    if (item.kind !== 'AUTOSAVE' || (faultAt !== null && item.at > faultAt)) continue;
    if (lastAutosaveAt === null || item.at > lastAutosaveAt) lastAutosaveAt = item.at;
  }
  // D60 (2026-11-04): six tracks — VIDEO-01..04 then AUDIO-01..02.
  const [v1, v2, v3, v4, a1, a2] = tracks;
  return {
    id: session.id,
    state: session.state,
    faultKind: session.fault?.kind ?? null,
    faultAt,
    fromState: session.fault?.fromState ?? null,
    startedAt: session.startedAt,
    caseNumber: session.input.caseNumber,
    subjectName: session.input.subjectName,
    subjectType: session.input.subjectType,
    room: session.input.room,
    bytesWritten: session.bytesWritten,
    lastAutosaveAt,
    video1: v1?.integrity ?? 'noMedia',
    video1Since: v1?.since ?? null,
    video2: v2?.integrity ?? 'noMedia',
    video2Since: v2?.since ?? null,
    video3: v3?.integrity ?? 'noMedia', // D60 (2026-11-04)
    video3Since: v3?.since ?? null, // D60
    video4: v4?.integrity ?? 'noMedia', // D60
    video4Since: v4?.since ?? null, // D60
    audio1: a1?.integrity ?? 'noMedia',
    audio1Since: a1?.since ?? null,
    audio2: a2?.integrity ?? 'noMedia',
    audio2Since: a2?.since ?? null,
    timeTo: time.to,
    timeAt: time.at,
  };
}

/** The structured findings of a set of inputs (pure). */
export interface RecoveryAnalysis {
  readonly tracks: readonly TrackFinding[];
  readonly segment: SegmentFinding;
  readonly time: TimeFinding;
}

export function analysisOf(inputs: RecoveryInputs): RecoveryAnalysis {
  // D60 (2026-11-04): six tracks (VIDEO-01..04, AUDIO-01..02).
  const integrity = [inputs.video1, inputs.video2, inputs.video3, inputs.video4, inputs.audio1, inputs.audio2];
  const since = [inputs.video1Since, inputs.video2Since, inputs.video3Since, inputs.video4Since, inputs.audio1Since, inputs.audio2Since];
  return {
    tracks: RECOVERY_TRACKS.map((track, i) => ({ track, integrity: integrity[i] ?? 'noMedia', since: since[i] ?? null })),
    segment: segmentFinding(inputs.startedAt, inputs.lastAutosaveAt),
    time: { from: 'GNSS', to: inputs.timeTo, at: inputs.timeAt },
  };
}

/**
 * The session this screen follows: the live one while it is in FAULT or RECOVERY, then the last such
 * values once recovery has cleared it from the store (the outcome card still names it). Another live
 * session (any other state) is returned as is and never latched. "Adjusting state while rendering"
 * (React's documented pattern): `live` keeps its identity while its values do not change.
 */
export function useFollowedRecovery(): RecoveryInputs | null {
  const live = useSim(selectRecoveryInputs);
  const followable = live !== null && (live.state === 'FAULT' || live.state === 'RECOVERY');
  const [latched, setLatched] = useState<RecoveryInputs | null>(followable ? live : null);
  if (followable && live !== latched) setLatched(live);
  return live ?? latched;
}

/** Pipeline milestones passed (0 … 8) on the simulator clock; 0 outside RECOVERY. */
export function useRecoveryMilestone(): number {
  return useSim((s) => recoveryMilestone(s.session?.recovery ?? null, s.clock.now));
}

/** The followed session's history entry (flat), once recovery has finished. */
export interface RecoveryOutcomeData {
  readonly outcome: SessionOutcome | null;
  readonly evidenceId: string | null;
  readonly durationMs: number;
  readonly sizeBytes: number;
  readonly endedAt: number | null;
  /** SIM-GAP-M81-1: the sealed item's signature, or null. */
  readonly signature: string | null;
}

export function useRecoveryOutcome(sessionId: string | null): RecoveryOutcomeData {
  return useSim((s) => {
    const entry = sessionId === null ? undefined : s.sessionHistory.find((candidate) => candidate.id === sessionId);
    const item = entry?.evidenceId ? s.evidence.find((candidate) => candidate.id === entry.evidenceId) : undefined;
    return {
      outcome: entry?.outcome ?? null,
      evidenceId: entry?.evidenceId ?? null,
      durationMs: entry?.durationMs ?? 0,
      sizeBytes: entry?.sizeBytes ?? 0,
      endedAt: entry?.endedAt ?? null,
      signature: recoverySignatureOf(item),
    };
  });
}

export function useRecoveryRole(): OperatorRole | null {
  return useSim(selectRole);
}

/** True once the Acknowledge beat is over on the simulator clock (flips once). */
export function useAckSettled(acknowledgedAt: number | null): boolean {
  return useSim((s) => ackSettled(acknowledgedAt, s.clock.now));
}

/** The simulator clock now (for one-off stamps in event handlers, never for rendering). */
export function useSimNow(): () => number {
  const sim = useSimInstance();
  return useCallback(() => sim.clock.now(), [sim]);
}

/** The outcome of `start`, handed to its continuation exactly once. */
export type RecoverySettled = (started: boolean) => void;

export interface RecoveryActions {
  /**
   * FAULT → RECOVERY (site S2-3). Calls `then(true)` once the Core holds RECOVERY (Simulated mode:
   * before `start` returns), or `then(false)` after a toast when refused. `then` runs exactly once,
   * in every path, so a pending control can release on it.
   */
  start(then?: RecoverySettled): void;
  /** Checks EVIDENCE_VIEW; returns false (after a toast) when refused. */
  canOpenEvidence(): boolean;
  /** Marks the followed fault's alerts as seen (bell); never throws (site S4-8). */
  acknowledgeAlerts(faultKind: FaultKind | null, faultAt: number | null): void;
}

const SOURCE_START = 'features.sessionRecovery.start';
const SOURCE_ACK = 'features.sessionRecovery.acknowledgeAlerts';

/**
 * The D61 error contract: SimPermissionError → a warning toast naming the role rule; a
 * SimTransitionError (the session left FAULT meanwhile) → a calm toast; anything else → a danger toast.
 * In Live mode the refusal presenter comes first (a denial with the role, an outage, a limit).
 * Every refusal and failure goes to the persistent runtime log (`dems.mobile.log.v1`).
 */
export function useRecoveryActions(role: OperatorRole | null): RecoveryActions {
  const actions = useCoreActions();
  const sim = useSimInstance();
  const live = useCoreLink().source === 'LIVE';
  const presentCoreError = useCoreErrorPresenter();
  const { toast } = useToast();
  const { t } = useTranslation();
  // Session actions are refused while the Core link is down (the runtime's one rule, row M2).
  const readOnly = useCoreLinkReadOnly();

  const start = useCallback(
    (then?: RecoverySettled): void => {
      if (readOnly) {
        toast.show({ variant: 'warning', label: t('features.session-recovery.actions.readOnly') });
        reportRuntimeIssue('info', SOURCE_START, 'Refused while the Core link is offline', { role });
        then?.(false);
        return;
      }
      settle(() => startRecovery(actions, role), {
        ok: () => then?.(true),
        fail: (error) => {
          // Live mode: a denial (the hint or the Core's 403), an outage or a limit is the presenter's
          // (one wording on every screen); it is an expected state of the role or the link.
          if (live && presentCoreError(error)) {
            reportRuntimeIssue('warn', SOURCE_START, error, {
              role,
              ...(error instanceof SimPermissionError ? { permission: error.permission } : {}),
            });
          } else if (error instanceof SimPermissionError) {
            toast.show({ variant: 'warning', label: t('features.session-recovery.actions.deniedStart') });
            reportRuntimeIssue('warn', SOURCE_START, error, { role, permission: error.permission });
          } else if (error instanceof SimTransitionError) {
            toast.show({ variant: 'default', label: t('features.session-recovery.actions.notInFault') });
            reportRuntimeIssue('warn', SOURCE_START, error, { role, from: error.from });
          } else {
            toast.show({ variant: 'danger', label: t('features.session-recovery.actions.failed') });
            reportRuntimeIssue('error', SOURCE_START, error, { role });
          }
          then?.(false);
        },
      });
    },
    [actions, live, presentCoreError, readOnly, role, toast, t],
  );

  const canOpenEvidence = useCallback((): boolean => {
    try {
      assertCanViewEvidence(role);
      return true;
    } catch (error) {
      toast.show({ variant: 'warning', label: t('features.session-recovery.actions.deniedView') });
      reportRuntimeIssue('warn', 'features.sessionRecovery.viewEvidence', error, { role });
      return false;
    }
  }, [role, toast, t]);

  const acknowledgeAlerts = useCallback(
    (faultKind: FaultKind | null, faultAt: number | null) => {
      if (faultKind === null || faultAt === null) return;
      const failed = (error: unknown): void => {
        if (live && presentCoreError(error)) {
          reportRuntimeIssue('warn', SOURCE_ACK, error, { faultKind });
          return;
        }
        reportRuntimeIssue('error', SOURCE_ACK, error, { faultKind });
      };
      try {
        // Read at press time (no render subscription to the alert list). In Live mode: the replica.
        const alerts = sim.store.getState().alerts;
        for (const alert of alerts) {
          if (alert.kind === faultKind && !alert.acknowledged && Math.abs(alert.at - faultAt) <= 1_000) {
            // S4-8: one request per alert, fired without waiting for each other; the Core treats an
            // alert that is already acknowledged as a no-op (01_specs §7.15).
            settle(() => actions.acknowledgeAlert(alert.id), { fail: failed });
          }
        }
      } catch (error) {
        reportRuntimeIssue('error', SOURCE_ACK, error, { faultKind });
      }
    },
    [actions, live, presentCoreError, sim],
  );

  return { start, canOpenEvidence, acknowledgeAlerts };
}
