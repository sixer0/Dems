/**
 * THE OPEN NOTICE of a recording that could not be sealed, on Home and its header (fix wave L,
 * G75d-01; ruling D228 (2); contract `delegation_progress/contract_wave_l.md` section 1).
 *
 * | The Core says | The app says |
 * |---|---|
 * | `openUnsealableNoticesOf(state)` is not empty (an ACTIVE alert `params.reason: UNSEALABLE`) | an OPEN NOTICE that does NOT block recording: the header chip, the ring and the status card state it - never plain "READY / All systems operational" while it is open |
 * | the signed-in role holds `UNSEALABLE_ACKNOWLEDGE_PERMISSION` (`canResolveUnsealable(role)`) | "Acknowledge this notice to close it." - the bell offers "Acknowledge and close" (operation 70), also for a notice somebody already acknowledged |
 * | any other role | "A supervisor acknowledges this notice to close it." |
 *
 * It is a statement about ITS session only (`sessionId` of the notice), never a fault of the session
 * that is open, and never a reason a recording cannot start. The sentence is the shared constant
 * without the code (`SEAL_UNSEALABLE_PLAIN_SENTENCE`); the cause is shown as a detail of its own.
 *
 * Read as ONE flat string, so nothing re-renders per frame (F74-13).
 */
import { canResolveUnsealable, openUnsealableNoticesOf, selectRole, useSim, type UnsealableNotice } from '@dems/shared/sim';

export type OpenNotice = Pick<UnsealableNotice, 'alertId' | 'sessionId' | 'cause' | 'acknowledged'>;

/** The open unsealable notices of the store, newest first. Empty: none. */
export function useOpenNotices(): readonly OpenNotice[] {
  const line = useSim((s) => {
    const notices = openUnsealableNoticesOf(s);
    return notices.length === 0 ? '' : JSON.stringify(notices.map(({ alertId, sessionId, cause, acknowledged }) => ({ alertId, sessionId, cause, acknowledged })));
  });
  return line === '' ? NONE : (JSON.parse(line) as OpenNotice[]);
}
const NONE: readonly OpenNotice[] = Object.freeze([]);

/** Whether the signed-in operator's acknowledgement closes an unsealable notice. */
export function useCanCloseNotice(): boolean {
  return useSim((s) => canResolveUnsealable(selectRole(s)));
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** The sentence of the status card: what is open, of which session, and that recording is not blocked. */
export function openNoticeDetail(t: Translate, notices: readonly OpenNotice[]): string {
  return notices.length === 1
    ? t('features.session-finalizing.openNotice.detailOne', { sessionId: notices[0]?.sessionId ?? '' })
    : t('features.session-finalizing.openNotice.detailMany', { count: notices.length });
}

/** Who closes it, as the signed-in role reads it. */
export function openNoticeCloseKey(canClose: boolean): string {
  return canClose ? 'features.session-finalizing.openNotice.closeByYou' : 'features.session-finalizing.openNotice.closeBySupervisor';
}
