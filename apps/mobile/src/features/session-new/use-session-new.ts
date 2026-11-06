/**
 * Hooks of the Start Session flow (step 78). Every function that calls a hook is named `use*`
 * (D66: the device build runs the React Compiler, which jest does not).
 *
 * Simulator reads follow F74-13: each `useSim` selector returns a primitive or a reference the
 * simulator keeps stable between changes (the precheck slice, the session input, the operator
 * list, one history entry), never a freshly built object, so the 20 Hz audio ticks re-render
 * nothing here. In Live mode the same selectors read the Live source's replica (CL-12).
 *
 * **Live mode** (backend task 04_client_integration_spec §8.5, §8.6; plan row W67). The actions
 * come from `useCoreActions()` and each result is consumed through `settle` (CL-25), so one call
 * site serves both data modes: in Simulated mode `settle` runs the continuation before it returns,
 * so the flow keeps its synchronous timing; in Live mode it runs in the turn in which the store
 * holds the command's effect (CL-16).
 *
 * | Site | Action(s) | Live behaviour |
 * |------|-----------|----------------|
 * | S1-4 | `createAndCheck`: `createSession` (twice, with `cancel` between, for a changed form on a CREATE session), then `beginPrecheck` | Nested `settle` in that order. A refused create keeps the inline error by reason; a 403 also shows the denied toast (AC-C-48). A rejection (outage, limit, refused precheck) goes to the presenter and leaves no inline error |
 * | S2-2 | `acknowledgeWarnings`, `retryChecks`, `cancelSession`, `startRecording` | Each reports `true` or `false` to its continuation (`then`) instead of returning it |
 *
 * Every rejection goes to the refusal presenter first in Live mode (`useCoreErrorPresenter`, §6.2,
 * LB-5 to LB-10), and only what it leaves gets the flow's own toast; in Simulated mode the flow's
 * own branch runs as before (the Pair screen's precedent, `pairing-screen.tsx:93`). Every path
 * writes the persistent runtime log (`reportRuntimeIssue`); no form value is logged.
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
import { settle, useCoreActions } from '@dems/shared/live';
import {
  PRECHECK_ORDER,
  Permission,
  RecordingProfileId,
  SimPermissionError,
  evaluateLiveReadiness,
  isSourceNotCheckedEvaluation,
  selectPrecheck,
  signedInOperatorId,
  startRefusedReasonOf,
  startRefusedSentenceKey,
  useSim,
  type CreateSessionResult,
  type PrecheckSlice,
  type SessionCreateInput,
  type SessionHistoryEntry,
  type SimOperator,
  type SimState,
} from '@dems/shared/sim';
import { reportRuntimeIssue, useActiveSession, useCoreErrorPresenter, useCoreLink, type RuntimeLogLevel } from '@/runtime';
import { useLocalSourceGate, type LocalSourceGate } from '@/features/capture-selector/local-source-notice';
import { encodeEvaluation, newestHistoryEntry } from './session-new-model';

// ---------------------------------------------------------------------------------------------
// Simulator reads (flat selectors)
// ---------------------------------------------------------------------------------------------

const selectSessionId = (s: SimState): string | null => s.session?.id ?? null;
const selectSessionInput = (s: SimState): SessionCreateInput | null => s.session?.input ?? null;
const selectOperators = (s: SimState): readonly SimOperator[] => s.operators;
const selectNewestHistory = (s: SimState): SessionHistoryEntry | null => newestHistoryEntry(s.sessionHistory);
/** The flat encoding of a live row the Core has not checked since it started (row 182, register C10). */
export const LIVE_NOT_CHECKED = encodeEvaluation('NOT_CHECKED', '');
/** True for a `useLiveReadiness` entry that reads "Not checked" (C11). */
export function isLiveNotChecked(encoded: string): boolean {
  return encoded === LIVE_NOT_CHECKED;
}
// Audit row 182 (M3-04 R5; register C10; D113, the web's row 150 `selectReadiness`): the step-1 live view reads the shared
// LIVE reader. On a Core in its own capture an assigned source with no reach reading since the Core started is
// "Not checked" (`isSourceNotCheckedEvaluation`), never PASS READY; every other answer is `evaluatePrecheck`'s own, so the
// simulated lane reads exactly as `evaluatePrecheck` (the reader `LiveChecks` used before row 182). The gate (step 2, the run) keeps `evaluatePrecheck`.
const selectLiveReadiness = (s: SimState): string[] =>
  PRECHECK_ORDER.map((id) => {
    const evaluation = evaluateLiveReadiness(s, id);
    return isSourceNotCheckedEvaluation(evaluation) ? LIVE_NOT_CHECKED : encodeEvaluation(evaluation.status, evaluation.value);
  });

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

/**
 * The live readiness of every check of `PRECHECK_ORDER` (row 182, C10), flat-encoded (`encodeEvaluation`), with
 * `LIVE_NOT_CHECKED` for a source the Core has not checked since it started (own capture only).
 */
export function useLiveReadiness(): string[] {
  return useSim(selectLiveReadiness);
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

/**
 * What step 1's Next got. `reason: null` (Live mode only): the refusal was already shown by the
 * presenter (an outage, a limit, a refused pre-check start), so the form shows no inline error.
 */
export type CreateOutcome = { readonly ok: true; readonly sessionId: string } | { readonly ok: false; readonly reason: CreateFailure | null };
export type CreateFailure = Exclude<CreateSessionResult, { ok: true }>['reason'] | 'UNEXPECTED';

/** The continuation of a flow action: `true` when the action went through, `false` when it was refused (already shown and logged). */
export type FlowSettled = (ok: boolean) => void;

export interface FlowActions {
  /** Step 1 → 2: `createSession(input)` → CREATE, then `beginPrecheck()` → PRECHECK (04 §4.4). `then` gets the outcome. */
  createAndCheck(values: SessionCreateRequest, then: (outcome: CreateOutcome) => void): void;
  /** WARN + "Acknowledge warnings" → ARMED (PRECHECK_PASSED with the warning count). */
  acknowledgeWarnings(then: FlowSettled): void;
  /** A resolved BLOCK or WARN outcome → a fresh run of every check of `PRECHECK_ORDER` (twelve since D53). */
  retryChecks(then: FlowSettled): void;
  /** CREATE, PRECHECK or ARMED → no session (audit SESSION_CANCELLED). */
  cancelSession(then: FlowSettled): void;
  /** ARMED → RECORDING. Throws nothing; `then(false)` when the simulator or the Core refused. */
  startRecording(then: FlowSettled): void;
  /**
   * Fix F-M4 (R69-01, D178): the confirm step in front of `createAndCheck` and `retryChecks` when the
   * selector names the Core Mac's camera or microphone. Nothing is sent before Confirm; a decline
   * reports `{ ok: false, reason: null }` / `false`. The screen mounts its dialog.
   */
  readonly localSourceGate: LocalSourceGate;
}

const SOURCE = 'features.sessionNew';

/** Error details safe to log: the error class and message, never form values (no PII). */
function logAction(action: string, error: unknown, state: SessionState | null, sessionId: string | null, level: RuntimeLogLevel = 'error'): void {
  reportRuntimeIssue(level, `${SOURCE}.${action}`, error, { state, sessionId });
}

export function useFlowActions(state: SessionState | null, sessionId: string | null): FlowActions {
  const actions = useCoreActions();
  const localSourceGate = useLocalSourceGate();
  const askLocalSource = localSourceGate.ask;
  const live = useCoreLink().source === 'LIVE';
  const presentCoreError = useCoreErrorPresenter();
  const { toast } = useToast();
  const { t } = useTranslation();

  const fail = useCallback(
    (action: string, error: unknown, message: string) => {
      // Closing pass J (item 7): a start the Core refused because of the session key (`503 NOT_READY`,
      // `details.reason`) says its own sentence - the presenter would word it as a Core that is starting.
      const refused = startRefusedReasonOf(error);
      if (refused !== null) {
        logAction(action, error, state, sessionId, 'warn');
        toast.show({ variant: 'danger', label: message, description: t(startRefusedSentenceKey(refused)) });
        return;
      }
      // Live mode: a denial, an outage or a limit is the presenter's (one wording on every screen);
      // it is an expected state of the link or the role, so it is logged as a warning.
      if (live && presentCoreError(error)) {
        logAction(action, error, state, sessionId, 'warn');
        return;
      }
      logAction(action, error, state, sessionId);
      toast.show({ variant: 'danger', label: message });
    },
    [live, presentCoreError, state, sessionId, toast, t],
  );

  // S1-4: `createSession` (and, for a changed form on a CREATE session, `cancel` then `createSession`
  // again), then `beginPrecheck`, each in the `ok` of the one before (nested `settle`, CL-25).
  const createAndCheck = useCallback(
    (values: SessionCreateRequest, then: (outcome: CreateOutcome) => void): void => {
      const failed = (error: unknown): void => {
        if (live && presentCoreError(error)) {
          logAction('create', error, state, sessionId, 'warn');
          then({ ok: false, reason: null });
          return;
        }
        logAction('create', error, state, sessionId);
        then({ ok: false, reason: 'UNEXPECTED' });
      };
      const judge = (result: CreateSessionResult): void => {
        if (!result.ok) {
          reportRuntimeIssue('warn', `${SOURCE}.create`, `createSession refused: ${result.reason}`, { reason: result.reason, state });
          // AC-C-48: in Live mode the Core's 403 also reads as the denied toast that names the role,
          // as on every screen; the inline error by reason stays (S1-4).
          if (live && result.reason === 'NOT_PERMITTED') presentCoreError(new SimPermissionError('createSession', Permission.SESSION_START));
          then({ ok: false, reason: result.reason });
          return;
        }
        settle(() => actions.beginPrecheck(), {
          ok: () => {
            reportRuntimeIssue('info', `${SOURCE}.create`, 'Session created; pre-recording checks started', {
              sessionId: result.sessionId,
              created: result.created,
            });
            then({ ok: true, sessionId: result.sessionId });
          },
          fail: failed,
        });
      };
      // Fix F-M4 (R69-01): a pre-check on a local device opens it on the Core Mac, so the operator confirms first; nothing is sent before.
      const send = (): void =>
      settle(() => actions.createSession(values), {
        ok: (result) => {
          // A CREATE session left by an earlier run with other details (edited after a relaunch): it
          // has no checks and no recording yet, so it is cancelled and created again. `state` is the
          // state seen before the call.
          if (!result.ok && result.reason === 'SESSION_ACTIVE' && state === 'CREATE') {
            settle(() => actions.cancel(), {
              ok: () => settle(() => actions.createSession(values), { ok: judge, fail: failed }),
              fail: failed,
            });
            return;
          }
          judge(result);
        },
        fail: failed,
      });
      askLocalSource(send, () => then({ ok: false, reason: null }));
    },
    [actions, askLocalSource, live, presentCoreError, state, sessionId],
  );

  // S2-2: a success or a throw (Simulated) or a rejection (Live) becomes the boolean of `then`.
  const guarded = useCallback(
    (action: string, run: () => unknown, message: string, then: FlowSettled): void => {
      settle(run, {
        ok: () => then(true),
        fail: (error) => {
          fail(action, error, message);
          then(false);
        },
      });
    },
    [fail],
  );

  return {
    createAndCheck,
    acknowledgeWarnings: (then) =>
      guarded('acknowledgeWarnings', () => actions.acknowledgePrecheckWarnings(), t('features.session-new.actionFailed'), then),
    retryChecks: (then) => askLocalSource(() => guarded('retryChecks', () => actions.retryPrecheck(), t('features.session-new.actionFailed'), then), () => then(false)),
    cancelSession: (then) => guarded('cancel', () => actions.cancel(), t('features.session-new.actionFailed'), then),
    // Fix F-M4 (D181 ruling 7): a recording keeps a local device ON, so the start asks by itself; the pre-check's consent never counts.
    startRecording: (then) => askLocalSource(() => guarded('startRecording', () => actions.startRecording(), t('features.session-new.ready.startFailed'), then), () => then(false), 'START'),
    localSourceGate,
  };
}
