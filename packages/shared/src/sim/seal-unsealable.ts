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
 * no retry.
 *
 * AN OPEN NOTICE, NOT A FAULT OF ANOTHER SESSION (fix wave L, driver L-S; re-check 75 finding
 * G75d-01; ruling D228 (2)). The alert stays `active` after its session ended: a recording sits in
 * quarantine and somebody has to know. It blocks nothing - the Core records the next session at
 * once - and it is a statement about ITS session only (`params.sessionId`), never about the session
 * that is open when a screen reads it. It ends in ONE way: an operator whose role holds
 * `UNSEALABLE_ACKNOWLEDGE_PERMISSION` acknowledges it (operation 70 `acknowledgeAlert`); that
 * acknowledgement resolves it and writes its audit row (`acknowledgeAlertTransition`, `faults.ts`).
 * A later sealed session, a restart of the Core and an acknowledgement by another role leave it
 * active. The readers of that rule are below; the transition itself is in `faults.ts`.
 */
import { roleHas } from './auth';
import type { EpochMs, SimAlert } from './types';
import { Permission, type OperatorRole } from './vocabulary';

/** `params.reason` of the alert and `details.reason` of the audit row. */
export const SEAL_UNSEALABLE_REASON = 'UNSEALABLE';

/** The sentence with its one value. `{{cause}}`: the code of the cause. */
export const SEAL_UNSEALABLE_SENTENCE = 'This recording could not be sealed. Its files were kept in quarantine on the Core. ({{cause}})';

/**
 * The same sentence without the code in brackets (fix wave L; G75d-04: "no code as a sentence"). The
 * alert's stored `message` keeps the bracket; a surface that must not print a code draws this and
 * shows `cause` as a detail of its own.
 */
export const SEAL_UNSEALABLE_PLAIN_SENTENCE = 'This recording could not be sealed. Its files were kept in quarantine on the Core.';

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
  /** The alert that carries the notice (`ALR-NNNNNN`): what operation 70 is sent with. */
  readonly alertId: string;
  /** Somebody acknowledged it and it is still open: the acknowledgement was not one that closes it. */
  readonly acknowledged: boolean;
}

/** True for THE alert of a session that could not be sealed, active or resolved. */
export function isUnsealableAlert(alert: Pick<SimAlert, 'kind' | 'params'>): boolean {
  return alert.kind === 'SYSTEM' && alert.params?.['reason'] === SEAL_UNSEALABLE_REASON;
}

const noticeOf = (alert: SimAlert): UnsealableNotice | null => {
  if (!alert.active || !isUnsealableAlert(alert)) return null;
  const sessionId = alert.params?.['sessionId'];
  const cause = alert.params?.['cause'];
  if (typeof sessionId !== 'string' || typeof cause !== 'string') return null;
  return { sessionId, cause, at: alert.at, alertId: alert.id, acknowledged: alert.acknowledged };
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

/**
 * THE ONE FACT FOR "AN OPEN NOTICE THAT DOES NOT BLOCK RECORDING" (fix wave L; G75d-01, D228 (2)):
 * every unsealable notice that is still open, newest first. Empty: none. A header, a Home ring and
 * a dashboard read this - and never draw "all systems operational" without it while it is not
 * empty, and never draw it as a fault of the open session.
 */
export function openUnsealableNoticesOf(state: { readonly alerts: readonly SimAlert[] }): UnsealableNotice[] {
  const notices: UnsealableNotice[] = [];
  for (const alert of state.alerts) {
    const notice = noticeOf(alert);
    if (notice !== null) notices.push(notice);
  }
  return notices.sort((left, right) => right.at - left.at);
}

/** `params.reason` of the alert of a blocked seal. Written here as text: `seal-blocked.ts` holds the constant and this file must not import it (it is exported beside this one). */
const BLOCKED_REASON = 'SEAL_BLOCKED';

/**
 * WHETHER AN ALERT, BY ITSELF, SAYS THAT THE CORE RECORDS NO NEW SESSION (fix wave L; G75d-01).
 *
 *   false  the unsealable notice: its session is ended, the Core is free. Such an alert is NEVER
 *          the fault, the attention state or the banner reason of the session that is open.
 *   true   an ACTIVE blocked seal: the Core takes no new session until that one is sealed.
 *   null   the alert does not say (every alert of a fault kind, every other notice): read the
 *          `faults` slice and the session as before.
 */
export function alertBlocksRecording(alert: Pick<SimAlert, 'kind' | 'params' | 'active'>): boolean | null {
  if (isUnsealableAlert(alert)) return false;
  if (alert.kind === 'SYSTEM' && alert.params?.['reason'] === BLOCKED_REASON) return alert.active;
  return null;
}

/** The permission whose holder's acknowledgement CLOSES an unsealable notice (ruling D228 (2): a supervisor). */
export const UNSEALABLE_ACKNOWLEDGE_PERMISSION = Permission.EVIDENCE_REVIEW;

/** True when an acknowledgement by this role closes an unsealable notice. Another role's acknowledgement is recorded and leaves it open. */
export function canResolveUnsealable(role: OperatorRole | null | undefined): boolean {
  return roleHas(role, UNSEALABLE_ACKNOWLEDGE_PERMISSION);
}

/** `details.operationId` of the audit row of the acknowledgement that closed a notice. */
export const UNSEALABLE_ACKNOWLEDGE_OPERATION = 'acknowledgeAlert';

/** The message of that audit row. `{{sessionId}}`: the session that could not be sealed. */
export const unsealableAcknowledgedSentence = (sessionId: string): string =>
  `The notice of session ${sessionId} (its recording could not be sealed and is kept in quarantine on the Core) was acknowledged and is closed`;

// ── Examples for the tests of the consumers (the shapes the Core writes; ids and instants are made up) ──

/** The id of the session the examples name. */
export const SEAL_UNSEALABLE_EXAMPLE_SESSION_ID = 'SES-20261011-0041';
const EXAMPLE_AT = 1_791_682_705_000;

/** The alert of a session that ended UNSEALABLE, as the Core raises it: OPEN until a supervisor acknowledges it. */
export const SEAL_UNSEALABLE_EXAMPLE_ALERT: SimAlert = Object.freeze({
  id: 'ALR-000049',
  at: EXAMPLE_AT,
  severity: 'CRITICAL',
  kind: 'SYSTEM',
  message: unsealableSentence('SESSION_KEY_NOT_OF_SESSION'),
  active: true,
  acknowledged: false,
  resolvedAt: null,
  target: SEAL_UNSEALABLE_EXAMPLE_SESSION_ID,
  params: { reason: SEAL_UNSEALABLE_REASON, cause: 'SESSION_KEY_NOT_OF_SESSION', sessionId: SEAL_UNSEALABLE_EXAMPLE_SESSION_ID },
}) as SimAlert;

/** The same alert after the acknowledgement that closed it. */
export const SEAL_UNSEALABLE_EXAMPLE_ALERT_RESOLVED: SimAlert = Object.freeze({ ...SEAL_UNSEALABLE_EXAMPLE_ALERT, active: false, acknowledged: true, resolvedAt: EXAMPLE_AT + 600_000 }) as SimAlert;
