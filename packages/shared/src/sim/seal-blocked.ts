/**
 * A SEAL THAT NEEDS ATTENTION, READ BY BOTH CLIENTS FROM THE STATE (task 3 fix wave I driver A1;
 * re-gate 75 finding G75b-02; rulings D186 (1), D216).
 *
 * NO CONTRACT MEMBER IS ADDED: the two facts are members the state already carries.
 *
 *   RETRYING  the seal failed and the Core runs it again by itself. The open session is FINALIZING,
 *             one step of `session.finalization.steps` has `status: 'error'` and its `detail` is
 *             the Core's sentence ("Sealing is being retried (retry 1 of 3, in 5 s). <cause>").
 *             No alert yet.
 *   BLOCKED   the retries of the Core are used up and the cause may heal (a signing key or a
 *             session key that is missing, the evidence volume, the database). The session STAYS
 *             FINALIZING, the Core takes no new session, and ONE alert says so:
 *               kind `SYSTEM`, severity CRITICAL, `active: true`, `target` = the session ID,
 *               `params: { reason: 'SEAL_BLOCKED', cause, step, sessionId, detail? }`,
 *               `message` = the cause in words, what restores it, what it costs meanwhile.
 *             `cause` is a code of the sealing pipeline (`SEALER_FAILED`, `SIGNER_FAILED`, ...);
 *             `detail`, when the Core knows more, a closed code beside it (`SEAL_BLOCKED_DETAILS`).
 *
 * THE RECORDING IS KEPT IN BOTH: a failed seal deletes nothing - the camera files stay where they
 * were recorded until a seal completes, and a session the Core gives up on is ended UNSEALABLE with
 * its files MOVED to the quarantine folder (`seal-unsealable.ts`). `recordingKept` is therefore the
 * constant `true`: it is here so that a surface states it from this file and not from a guess.
 *
 * WHAT `attempt` IS NOT. The attempt of a step grows with EVERY run of the seal: a retry in the
 * same process as much as a run after a restart. `attempt > 1` therefore says "the seal was run
 * again", never "the Core was restarted". The fact "resumed at a start of the Core or by the
 * recovery action" is `resumed` of operation 83 `getSealingProgress`, and only that.
 *
 * This file imports types only.
 */
import type { ActiveSession, EpochMs, SimAlert } from './types';

/** `params.reason` of the alert of a blocked seal (the Core's `alerts.reason`). */
export const SEAL_BLOCKED_REASON = 'SEAL_BLOCKED';

/**
 * `params.detail` of the alert, `details.reason` of a refused start and the `cause` of the log
 * lines: WHY the session key could not be used. A closed list; no value names a path or a key.
 */
export const SEAL_BLOCKED_DETAILS = [
  /** A session key of that session ID is in the key store and is not the key of this session (an earlier session of the same number left it). */
  'SESSION_KEY_NOT_OF_SESSION',
  /** The key store of the Core cannot be reached, or is not a private folder of the server user. */
  'SESSION_KEY_STORE_UNAVAILABLE',
  /** The key file is not a private key file of the server user. */
  'SESSION_KEY_UNSAFE',
  /** The key could not be written to the key store. */
  'SESSION_KEY_WRITE_FAILED',
  /** The key of the session is not in the key store. */
  'SESSION_KEY_NOT_FOUND',
  /** The cipher refused the fragment (a repeated nonce, an input it cannot seal). */
  'SESSION_CIPHER_REFUSED',
] as const;
export type SealBlockedDetail = (typeof SEAL_BLOCKED_DETAILS)[number];

const isDetail = (value: unknown): value is SealBlockedDetail => typeof value === 'string' && (SEAL_BLOCKED_DETAILS as readonly string[]).includes(value);

/** One sentence per detail code: what a surface may say of it. Fixed text, no value. */
export const SEAL_BLOCKED_DETAIL_SENTENCE: Readonly<Record<SealBlockedDetail, string>> = Object.freeze({
  SESSION_KEY_NOT_OF_SESSION: "A session key of an earlier session with this session number is in the Core's key store. It is never reused.",
  SESSION_KEY_STORE_UNAVAILABLE: "The Core's key store cannot be used.",
  SESSION_KEY_UNSAFE: "The key file of this session is not a private file of the Core.",
  SESSION_KEY_WRITE_FAILED: "The session key could not be written to the Core's key store.",
  SESSION_KEY_NOT_FOUND: "The key of this session is not in the Core's key store.",
  SESSION_CIPHER_REFUSED: 'The Core could not encrypt a part of the recording.',
});

/** What a surface says of the recording of a seal that failed, is retried or is blocked. True for every one of them. */
export const SEAL_RECORDING_KEPT_SENTENCE = 'The recording is kept on the Core.';

export interface SealBlockedNotice {
  readonly sessionId: string;
  /** The failure code of the seal (`SEALER_FAILED`, `SIGNER_FAILED`, `STORAGE_FAILED`, ...). */
  readonly cause: string;
  /** The sealing step that failed (`CLOSE_TRACKS`, ...), or null when the alert names none. */
  readonly step: string | null;
  /** The closed code beside the cause, or null. */
  readonly detail: SealBlockedDetail | null;
  /** The Core's sentence: the cause in words, what restores it, what it costs meanwhile. */
  readonly message: string;
  /** When the Core raised the alert. */
  readonly at: EpochMs;
}

const noticeOf = (alert: SimAlert): SealBlockedNotice | null => {
  if (!alert.active || alert.kind !== 'SYSTEM' || alert.params?.['reason'] !== SEAL_BLOCKED_REASON) return null;
  const sessionId = alert.params['sessionId'] ?? alert.target;
  const cause = alert.params['cause'];
  if (typeof sessionId !== 'string' || typeof cause !== 'string') return null;
  const step = alert.params['step'];
  const detail = alert.params['detail'];
  return { sessionId, cause, step: typeof step === 'string' ? step : null, detail: isDetail(detail) ? detail : null, message: alert.message, at: alert.at };
};

/** The blocked seal the Core reported: of `sessionId`, or - without one - the most recent active one. Null when there is none. */
export function sealBlockedNoticeOf(state: { readonly alerts: readonly SimAlert[] }, sessionId?: string | null): SealBlockedNotice | null {
  let latest: SealBlockedNotice | null = null;
  for (const alert of state.alerts) {
    const notice = noticeOf(alert);
    if (notice === null) continue;
    if (sessionId !== undefined && sessionId !== null && notice.sessionId !== sessionId) continue;
    if (latest === null || notice.at >= latest.at) latest = notice;
  }
  return latest;
}

/** What the session surfaces show of a seal that is not simply running. */
export type SealAttention =
  | {
      readonly kind: 'RETRYING';
      readonly sessionId: string;
      /** The step that failed. */
      readonly step: string;
      /** The run of the seal that failed (>= 1). NOT a count of restarts. */
      readonly attempt: number;
      /** The Core's sentence on the failed step, or null when it wrote none. */
      readonly sentence: string | null;
      readonly recordingKept: true;
    }
  | {
      readonly kind: 'BLOCKED';
      readonly sessionId: string;
      readonly cause: string;
      readonly step: string | null;
      readonly detail: SealBlockedDetail | null;
      /** The sentence of the failed step when the state has one, else the alert's. */
      readonly sentence: string;
      /** The alert's whole message: with what restores the seal. */
      readonly message: string;
      readonly attempt: number;
      readonly recordingKept: true;
    };

type SealAttentionState = { readonly session: Pick<ActiveSession, 'id' | 'state' | 'finalization'> | null; readonly alerts: readonly SimAlert[] };

/**
 * THE ONE READING for the Finalizing screen and the seal dialog. Null: the seal runs, has not
 * started, or there is no open session - nothing to say beyond the progress.
 */
export function sealAttentionOf(state: SealAttentionState): SealAttention | null {
  const session = state.session;
  if (session === null) return null;
  const failed = session.finalization.steps.find((step) => step.status === 'error') ?? null;
  const attempt = Math.max(1, ...session.finalization.steps.map((step) => step.attempt ?? 1));
  const blocked = sealBlockedNoticeOf(state, session.id);
  if (blocked !== null) {
    return { kind: 'BLOCKED', sessionId: session.id, cause: blocked.cause, step: blocked.step ?? failed?.id ?? null, detail: blocked.detail, sentence: failed?.detail ?? blocked.message, message: blocked.message, attempt, recordingKept: true };
  }
  if (failed === null) return null;
  return { kind: 'RETRYING', sessionId: session.id, step: failed.id, attempt, sentence: failed.detail ?? null, recordingKept: true };
}

// ── Examples for the tests of the consumers (the shapes the Core writes; ids and instants are made up) ──

const EXAMPLE_SESSION = 'SES-20261010-0025';
const EXAMPLE_AT = 1_791_636_968_000;
const pendingStep = (id: ActiveSession['finalization']['steps'][number]['id']): ActiveSession['finalization']['steps'][number] => ({ id, status: 'pending', startedAt: null, completedAt: null, durationMs: null, progress: 0, etaMs: null, detail: null, attempt: 4 });

/** `session.finalization` of a seal whose first step failed four times: the last sentence the Core wrote on it. */
export const SEAL_BLOCKED_EXAMPLE_FINALIZATION: ActiveSession['finalization'] = Object.freeze({
  steps: [
    { id: 'CLOSE_TRACKS', status: 'error', startedAt: EXAMPLE_AT - 155_000, completedAt: null, durationMs: null, progress: 0, etaMs: null, detail: "The Core's key store cannot be used: the seal stopped and can be tried again. Sealing will be tried again when the Core starts, or by the recovery action.", attempt: 4 },
    pendingStep('FINALIZE_HASHES'),
    pendingStep('FINALIZE_TRANSCRIPT'),
    pendingStep('BUILD_MANIFEST'),
    pendingStep('SIGN_MANIFEST'),
    pendingStep('STORE_SEALED_PACKAGE'),
  ],
  startedAt: EXAMPLE_AT - 155_000,
  completedAt: null,
}) as ActiveSession['finalization'];

/** The alert of that blocked seal, as the Core raises it. */
export const SEAL_BLOCKED_EXAMPLE_ALERT: SimAlert = Object.freeze({
  id: 'ALR-000005',
  at: EXAMPLE_AT,
  severity: 'CRITICAL',
  kind: 'SYSTEM',
  message:
    "Sealing of this session is blocked. The Core's key store cannot be used: the seal stopped and can be tried again. Check the Core's key store (the credential store folder of the data directory: a private folder the server user can write), then start recovery for the session or restart the Core. The Core records no new session until this one is sealed.",
  active: true,
  acknowledged: false,
  resolvedAt: null,
  target: EXAMPLE_SESSION,
  params: { reason: SEAL_BLOCKED_REASON, cause: 'SEALER_FAILED', step: 'CLOSE_TRACKS', sessionId: EXAMPLE_SESSION, detail: 'SESSION_KEY_STORE_UNAVAILABLE' },
}) as SimAlert;

/** The same seal while the Core still retries by itself: the failed step's sentence, no alert. */
export const SEAL_RETRYING_EXAMPLE_FINALIZATION: ActiveSession['finalization'] = Object.freeze({
  ...SEAL_BLOCKED_EXAMPLE_FINALIZATION,
  steps: SEAL_BLOCKED_EXAMPLE_FINALIZATION.steps.map((step) => ({
    ...step,
    attempt: 2,
    ...(step.status === 'error' ? { detail: "Sealing is being retried (retry 2 of 3, in 30 s). The Core's key store cannot be used: the seal stopped and can be tried again." } : {}),
  })),
}) as ActiveSession['finalization'];

/** The id of the session the examples name. */
export const SEAL_BLOCKED_EXAMPLE_SESSION_ID = EXAMPLE_SESSION;
