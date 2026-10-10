/**
 * The sealing notice doors of the engine host (task 3 fix pass F-M7c; review row 88 findings
 * R88-05 (c) and R88-02; controller ruling D186), reached beside the seam like the seal doors
 * (`sealingNoticeDoorsOf(app.engine)`), and NOT members of `EngineHost`. Four facts only the
 * sealing composition knows, each ONE unit with no permission check (the caller is the Core):
 *
 *   noteSealedPlaintextKept   plaintext of a SEALED session could not be proven to be what the
 *                             package sealed and is moved to the quarantine: ONE CRITICAL alert +
 *                             ONE audit row (`FAULT_RAISED`, `details.reason:
 *                             SEALED_PLAINTEXT_QUARANTINED`) naming the session. Raised once: while
 *                             the alert of that session is active a second call writes nothing.
 *   raiseSealBlocked          the seal of the open session failed for a cause that may heal and
 *                             the retries of the process are used up: the session stays FINALIZING
 *                             and the Core takes no new session. ONE CRITICAL alert naming the
 *                             cause and what restores it; raised once per session.
 *   resolveSealBlocked        that alert is resolved (the seal completed, or the session ended).
 *   noteSealRetryOnDemand     an operator asked for the failed seal to be run again through the
 *                             recovery operation: ONE audit row (`RECOVERY_STARTED`,
 *                             `details.reason: SEAL_RETRY`) with who asked, the session and the
 *                             cause being retried.
 *
 * No audit type and no alert kind is added: the existing types carry a `reason` (the alert's
 * `params.reason` is the stored column `alerts.reason`). The transitions are pure and local: the
 * simulator has no seal that fails, so there is nothing for it to agree with.
 */
import { ALERT_RING_SIZE, nextItemId, pushRing, recordActivity, type SimAlert, type SimState } from '@dems/shared/sim';
import { EngineError } from './errors';
import type { EngineHost, EngineOutcome } from './types';

/** `alerts.reason` of the two notices. */
export const SEALED_PLAINTEXT_REASON = 'SEALED_PLAINTEXT_QUARANTINED';
export const SEAL_BLOCKED_REASON = 'SEAL_BLOCKED';
/** `audit.details.reason` of the on-demand retry. */
export const SEAL_RETRY_REASON = 'SEAL_RETRY';

const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

export interface SealedPlaintextKeptInput {
  readonly sessionId: string;
  readonly files: readonly { readonly trackId: string; readonly name: string; readonly reason: string }[];
}
export interface SealBlockedInput {
  readonly sessionId: string;
  /** The failure code of the seal (`SealingFailure`). */
  readonly cause: string;
  /** The sealing step that failed. */
  readonly step: string;
  /** What an operator reads: the cause in words and what restores it. */
  readonly message: string;
}
export interface SealRetryNote {
  readonly sessionId: string;
  /** The operator who asked, or null when the caller did not say. */
  readonly actorId: string | null;
  readonly cause: string | null;
  readonly step: string | null;
}

export interface EngineSealingNoticeDoors {
  noteSealedPlaintextKept(input: SealedPlaintextKeptInput): Promise<EngineOutcome<boolean>>;
  raiseSealBlocked(input: SealBlockedInput): Promise<EngineOutcome<boolean>>;
  resolveSealBlocked(input: { readonly sessionId: string }): Promise<EngineOutcome<boolean>>;
  noteSealRetryOnDemand(input: SealRetryNote): Promise<EngineOutcome<boolean>>;
}

/** Labels of the units (a label of the host is `engine.<what it does>`). */
export const SEALING_NOTICE_DOOR_LABEL = { plaintextKept: 'engine.noteSealedPlaintextKept', blocked: 'engine.raiseSealBlocked', unblocked: 'engine.resolveSealBlocked', retry: 'engine.noteSealRetryOnDemand' } as const;

const activeNotice = (state: Pick<SimState, 'alerts'>, reason: string, sessionId: string): SimAlert | undefined => state.alerts.find((alert) => alert.active && alert.kind === 'SYSTEM' && alert.params?.['reason'] === reason && (alert.target ?? null) === sessionId);

function withAlert(state: SimState, now: number, sessionId: string, message: string, params: NonNullable<SimAlert['params']>): SimState {
  const { id, meta } = nextItemId(state.meta, 'ALR');
  const alert: SimAlert = { id, at: now, severity: 'CRITICAL', kind: 'SYSTEM', message, active: true, acknowledged: false, resolvedAt: null, target: sessionId, params };
  return { ...state, meta, alerts: pushRing(state.alerts, [alert], ALERT_RING_SIZE) };
}

const invalid = (what: string): never => {
  throw new EngineError('ENGINE_ACTION_NOT_HOSTED', `a sealing notice was called with ${what}`);
};

/** One alert + one audit row for the session; the SAME state while its alert is active. */
export function noteSealedPlaintextKeptTransition(state: SimState, now: number, input: SealedPlaintextKeptInput): SimState {
  if (typeof input.sessionId !== 'string' || !SESSION_ID.test(input.sessionId)) invalid('no session ID');
  if (!Array.isArray(input.files) || input.files.length < 1 || input.files.length > 8 || input.files.some((file) => !CODE.test(file.reason) || !/^VIDEO-0[12]$/.test(file.trackId))) invalid('a file list that is not codes');
  if (activeNotice(state, SEALED_PLAINTEXT_REASON, input.sessionId) !== undefined) return state;
  const evidenceId = state.evidence.find((item) => item.sessionId === input.sessionId)?.id ?? null;
  const files = input.files.map((file) => `${file.trackId}:${file.reason}`).join(',');
  const message = `Session ${input.sessionId} is sealed, but ${input.files.length} file(s) under the name of a recording could not be proven to be the recording that was sealed. They were kept in quarantine on the Core.`;
  const next = withAlert(state, now, input.sessionId, message, { reason: SEALED_PLAINTEXT_REASON, sessionId: input.sessionId, files });
  return {
    ...next,
    ...recordActivity(next, now, {
      audit: { type: 'FAULT_RAISED', message: `Plaintext of sealed session ${input.sessionId} was kept in the quarantine folder (${files})`, severity: 'CRITICAL', actorId: null, sessionId: input.sessionId, evidenceId, details: { reason: SEALED_PLAINTEXT_REASON, files, count: input.files.length } },
    }),
  };
}

/** One CRITICAL alert for the OPEN session; the same state when it is not the open session or the alert is active. */
export function raiseSealBlockedTransition(state: SimState, now: number, input: SealBlockedInput): SimState {
  if (typeof input.sessionId !== 'string' || !SESSION_ID.test(input.sessionId) || !CODE.test(input.cause) || !CODE.test(input.step) || typeof input.message !== 'string' || input.message.length < 1 || input.message.length > 400) invalid('a cause that is no code');
  if (state.session === null || state.session.id !== input.sessionId) return state;
  if (activeNotice(state, SEAL_BLOCKED_REASON, input.sessionId) !== undefined) return state;
  return withAlert(state, now, input.sessionId, input.message, { reason: SEAL_BLOCKED_REASON, cause: input.cause, step: input.step, sessionId: input.sessionId });
}

/** The active blocked alert of the session is resolved; the same state when there is none. */
export function resolveSealBlockedTransition(state: SimState, now: number, input: { readonly sessionId: string }): SimState {
  const active = activeNotice(state, SEAL_BLOCKED_REASON, input.sessionId);
  if (active === undefined) return state;
  return { ...state, alerts: state.alerts.map((alert) => (alert === active ? { ...alert, active: false, resolvedAt: now } : alert)) };
}

/** One audit row for the retry an operator asked for; the same state when the session is not the open one. */
export function noteSealRetryOnDemandTransition(state: SimState, now: number, input: SealRetryNote): SimState {
  if (typeof input.sessionId !== 'string' || !SESSION_ID.test(input.sessionId) || (input.cause !== null && !CODE.test(input.cause)) || (input.step !== null && !CODE.test(input.step))) invalid('a cause that is no code');
  const session = state.session;
  if (session === null || session.id !== input.sessionId) return state;
  return {
    ...state,
    ...recordActivity(state, now, {
      audit: {
        type: 'RECOVERY_STARTED',
        message: `Sealing of session ${session.id} is run again on demand${input.cause === null ? '' : ` (${input.cause})`}`,
        severity: 'WARNING',
        actorId: input.actorId,
        sessionId: session.id,
        evidenceId: session.evidenceId ?? null,
        details: { reason: SEAL_RETRY_REASON, cause: input.cause, step: input.step, faultKind: session.fault?.kind ?? null },
      },
    }),
  };
}

/** The sealing notice doors of the engine behind the seam. Refuses an engine that has none (a test's stub). */
export function sealingNoticeDoorsOf(engine: EngineHost): EngineSealingNoticeDoors {
  const doors = engine as EngineHost & Partial<EngineSealingNoticeDoors>;
  if (typeof doors.noteSealedPlaintextKept !== 'function' || typeof doors.raiseSealBlocked !== 'function' || typeof doors.resolveSealBlocked !== 'function' || typeof doors.noteSealRetryOnDemand !== 'function') {
    throw new EngineError('ENGINE_ACTION_NOT_HOSTED', 'the engine behind the seam is not the host of src/engine: it has no sealing notice doors');
  }
  return doors as EngineHost & EngineSealingNoticeDoors;
}
