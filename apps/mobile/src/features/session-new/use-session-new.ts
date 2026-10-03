/**
 * Hooks of the Start Session flow (step 78). Every function that calls a hook is named `use*`
 * (D66: the device build runs the React Compiler, which jest does not).
 *
 * Simulator reads follow F74-13: each `useSim` selector returns a primitive or a reference the
 * simulator keeps stable between changes (the precheck slice, the session input, the operator
 * list, one history entry), never a freshly built object, so the 20 Hz audio ticks re-render
 * nothing here.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from 'heroui-native';
import { useCallback } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { SessionState } from '@dems/shared/domain';
import {
  DEFAULT_SESSION_ROOM,
  sessionCreateSchema,
  type SessionCreateFormValues,
  type SessionCreateRequest,
} from '@dems/shared/api';
import {
  PRECHECK_ORDER,
  RecordingProfileId,
  evaluatePrecheck,
  selectPrecheck,
  signedInOperatorId,
  useSim,
  useSimActions,
  type CreateSessionResult,
  type PrecheckSlice,
  type SessionCreateInput,
  type SessionHistoryEntry,
  type SimOperator,
  type SimState,
} from '@dems/shared/sim';
import { reportRuntimeIssue, useActiveSession } from '@/runtime';
import { encodeEvaluation, newestHistoryEntry } from './session-new-model';

// ---------------------------------------------------------------------------------------------
// Simulator reads (flat selectors)
// ---------------------------------------------------------------------------------------------

const selectSessionId = (s: SimState): string | null => s.session?.id ?? null;
const selectSessionInput = (s: SimState): SessionCreateInput | null => s.session?.input ?? null;
const selectOperators = (s: SimState): readonly SimOperator[] => s.operators;
const selectNewestHistory = (s: SimState): SessionHistoryEntry | null => newestHistoryEntry(s.sessionHistory);
const selectLiveEvaluations = (s: SimState): string[] =>
  PRECHECK_ORDER.map((id) => {
    const evaluation = evaluatePrecheck(s, id);
    return encodeEvaluation(evaluation.status, evaluation.value);
  });
const selectMicSignals = (s: SimState): string[] => s.mics.map((mic) => mic.state);

export interface SessionNewData {
  readonly state: SessionState | null;
  readonly sessionId: string | null;
  readonly precheck: PrecheckSlice | null;
  readonly input: SessionCreateInput | null;
  readonly operators: readonly SimOperator[];
  readonly signedInId: string | null;
  readonly newestHistory: SessionHistoryEntry | null;
}

export function useSessionNewData(): SessionNewData {
  // The state the wizard routes by comes from the runtime contract (the same source as the shell's
  // resync and deep-link policies, §3.5/§3.7; in the app it is derived from the simulator store in
  // the same render). The details come from the simulator.
  const state = useActiveSession().state;
  const sessionId = useSim(selectSessionId);
  const precheck = useSim(selectPrecheck);
  const input = useSim(selectSessionInput);
  const operators = useSim(selectOperators);
  const signedInId = useSim(signedInOperatorId);
  const newestHistory = useSim(selectNewestHistory);
  return { state, sessionId, precheck, input, operators, signedInId, newestHistory };
}

/** The §5.3 checks evaluated against the live device state (tablet device column), flat-encoded. */
export function useLiveEvaluations(): string[] {
  return useSim(selectLiveEvaluations);
}

/** MIC 1 and MIC 2 states (`READY`, `NO_SIGNAL`, `CLIP`) for the preview meters. */
export function useMicSignals(): string[] {
  return useSim(selectMicSignals);
}

// ---------------------------------------------------------------------------------------------
// Step 1 form (react-hook-form + the shared zod schema, D62)
// ---------------------------------------------------------------------------------------------

export type SessionForm = UseFormReturn<SessionCreateFormValues, unknown, SessionCreateRequest>;

/** An empty form with the MB 3 defaults: investigator = the signed-in operator, room, profile. */
export function blankFormValues(investigatorId: string): SessionCreateFormValues {
  return {
    caseNumber: '',
    // No subject type until the operator picks one (zod: "Choose a subject type.").
    subjectType: undefined as unknown as SessionCreateFormValues['subjectType'],
    subjectName: '',
    investigatorId,
    room: DEFAULT_SESSION_ROOM,
    profileId: RecordingProfileId.STANDARD_1080P25,
    notes: '',
  };
}

/** The form values of a session the simulator already holds (CREATE after a relaunch). */
export function formValuesFromInput(input: SessionCreateInput): SessionCreateFormValues {
  return {
    caseNumber: input.caseNumber,
    subjectType: input.subjectType,
    subjectName: input.subjectName,
    investigatorId: input.investigatorId,
    room: input.room,
    profileId: input.profileId,
    notes: input.notes ?? '',
  };
}

export function useSessionForm(defaults: SessionCreateFormValues): SessionForm {
  return useForm<SessionCreateFormValues, unknown, SessionCreateRequest>({
    resolver: zodResolver(sessionCreateSchema),
    // "Next" is disabled until the schema validates (04 §4.4), so validity is tracked live.
    mode: 'onChange',
    defaultValues: defaults,
  });
}

// ---------------------------------------------------------------------------------------------
// Actions, with the three-layer error handling (toast, persistent log, the screen stays usable)
// ---------------------------------------------------------------------------------------------

export type CreateOutcome = { readonly ok: true; readonly sessionId: string } | { readonly ok: false; readonly reason: CreateFailure };
export type CreateFailure = Exclude<CreateSessionResult, { ok: true }>['reason'] | 'UNEXPECTED';

export interface FlowActions {
  /** Step 1 → 2: `createSession(input)` → CREATE, then `beginPrecheck()` → PRECHECK (04 §4.4). */
  createAndCheck(values: SessionCreateRequest): CreateOutcome;
  /** WARN + "Acknowledge warnings" → ARMED (PRECHECK_PASSED with the warning count). */
  acknowledgeWarnings(): boolean;
  /** A resolved BLOCK or WARN outcome → a fresh run of all eight checks. */
  retryChecks(): boolean;
  /** CREATE, PRECHECK or ARMED → no session (audit SESSION_CANCELLED). */
  cancelSession(): boolean;
  /** ARMED → RECORDING. Throws nothing; false when the simulator refused. */
  startRecording(): boolean;
}

const SOURCE = 'features.sessionNew';

/** Error details safe to log: the error class and message, never form values (no PII). */
function logAction(action: string, error: unknown, state: SessionState | null, sessionId: string | null): void {
  reportRuntimeIssue('error', `${SOURCE}.${action}`, error, { state, sessionId });
}

export function useFlowActions(state: SessionState | null, sessionId: string | null): FlowActions {
  const actions = useSimActions();
  const { toast } = useToast();
  const { t } = useTranslation();

  const fail = useCallback(
    (action: string, error: unknown, message: string) => {
      logAction(action, error, state, sessionId);
      toast.show({ variant: 'danger', label: message });
    },
    [state, sessionId, toast],
  );

  const createAndCheck = useCallback(
    (values: SessionCreateRequest): CreateOutcome => {
      try {
        let result = actions.createSession(values);
        // A CREATE session left by an earlier run with other details (edited after a relaunch):
        // it has no checks and no recording yet, so it is cancelled and created again.
        if (!result.ok && result.reason === 'SESSION_ACTIVE' && state === 'CREATE') {
          actions.cancel();
          result = actions.createSession(values);
        }
        if (!result.ok) {
          reportRuntimeIssue('warn', `${SOURCE}.create`, `createSession refused: ${result.reason}`, { reason: result.reason, state });
          return { ok: false, reason: result.reason };
        }
        actions.beginPrecheck();
        reportRuntimeIssue('info', `${SOURCE}.create`, 'Session created; pre-recording checks started', {
          sessionId: result.sessionId,
          created: result.created,
        });
        return { ok: true, sessionId: result.sessionId };
      } catch (error) {
        logAction('create', error, state, sessionId);
        return { ok: false, reason: 'UNEXPECTED' };
      }
    },
    [actions, state, sessionId],
  );

  const guarded = useCallback(
    (action: string, run: () => void, message: string): boolean => {
      try {
        run();
        return true;
      } catch (error) {
        fail(action, error, message);
        return false;
      }
    },
    [fail],
  );

  return {
    createAndCheck,
    acknowledgeWarnings: () => guarded('acknowledgeWarnings', () => actions.acknowledgePrecheckWarnings(), t('features.session-new.actionFailed')),
    retryChecks: () => guarded('retryChecks', () => actions.retryPrecheck(), t('features.session-new.actionFailed')),
    cancelSession: () => guarded('cancel', () => actions.cancel(), t('features.session-new.actionFailed')),
    startRecording: () => guarded('startRecording', () => actions.startRecording(), t('features.session-new.ready.startFailed')),
  };
}
