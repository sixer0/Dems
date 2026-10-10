/**
 * THE TERMINAL OUTCOME "UNSEALABLE" (task 3 fix pass F-M7b; review row 88 finding R88-02 (c);
 * rulings D178 (2), D183): what a session is called when the Core cannot seal it - no camera file
 * validates, or a cause no retry gets past reached its bound.
 *
 * The session is ENDED as INCOMPLETE (`endUnsealableTransition`, `session-machine.ts`); what tells
 * everybody WHY is ONE alert and ONE audit row:
 *
 *   alert   kind `SYSTEM`, severity CRITICAL, `target` = the session ID,
 *           `params: { reason: 'UNSEALABLE', cause, sessionId }`, the sentence below as `message`
 *   audit   `SESSION_INCOMPLETE`, severity CRITICAL, `details: { reason: 'UNSEALABLE', cause, ... }`
 *
 * `cause` is a CODE of the sealing pipeline (`NOTHING_SEALABLE`, `MANIFEST_INVALID`, ...): never a
 * path, a hash or free text. The recordings are not deleted: the Core moved them to its quarantine
 * folder before it ended the session.
 *
 * ONE SENTENCE, read by the simulator's alert, by the i18n resources (`common.sealUnsealable`) and
 * by both clients. It states a condition of the recording; it is not an operator error and offers
 * no retry. This file imports types only.
 */
import type { EpochMs, SimAlert } from './types';

/** `params.reason` of the alert and `details.reason` of the audit row. */
export const SEAL_UNSEALABLE_REASON = 'UNSEALABLE';

/** The sentence with its one value. `{{cause}}`: the code of the cause. */
export const SEAL_UNSEALABLE_SENTENCE = 'This recording could not be sealed. Its files were kept in quarantine on the Core. ({{cause}})';

/** What an operator reads of a session that could not be sealed. */
export function unsealableSentence(cause: string): string {
  return SEAL_UNSEALABLE_SENTENCE.replace('{{cause}}', cause);
}

/** A cause as the alert and the audit row hold it: a code. */
export const SEAL_UNSEALABLE_CAUSE_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

export interface UnsealableNotice {
  readonly sessionId: string;
  readonly cause: string;
  /** When the session was ended as unsealable. */
  readonly at: EpochMs;
}

const noticeOf = (alert: SimAlert): UnsealableNotice | null => {
  if (!alert.active || alert.kind !== 'SYSTEM' || alert.params?.['reason'] !== SEAL_UNSEALABLE_REASON) return null;
  const sessionId = alert.params['sessionId'];
  const cause = alert.params['cause'];
  if (typeof sessionId !== 'string' || typeof cause !== 'string') return null;
  return { sessionId, cause, at: alert.at };
};

/**
 * The UNSEALABLE state the Core reported: of `sessionId`, or - without one - the most recent that
 * is still active (not resolved). Null when there is none. Read from the alerts only, so a client
 * shows it as a STATE of the recording whatever screen it is on.
 */
export function unsealableNoticeOf(state: { readonly alerts: readonly SimAlert[] }, sessionId?: string | null): UnsealableNotice | null {
  let latest: UnsealableNotice | null = null;
  for (const alert of state.alerts) {
    const notice = noticeOf(alert);
    if (notice === null) continue;
    if (sessionId !== undefined && sessionId !== null && notice.sessionId !== sessionId) continue;
    if (latest === null || notice.at >= latest.at) latest = notice;
  }
  return latest;
}
