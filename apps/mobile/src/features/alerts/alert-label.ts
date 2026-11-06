/**
 * The words of ONE alert, the same in the bell's list and on its toast (fix wave J, JA2-05; the rules are
 * the bell's of passes D7 / row 138 / wave L, moved here unchanged so two surfaces cannot word an alert
 * differently):
 *
 * 1. an open unsealable notice: its session and the plain sentence (no code as a sentence);
 * 2. the alert of a failed start: "No camera connected. Nothing was recorded." / the generic sentence;
 * 3. a capture fault or a capture notice: worded from `params.reason` with the device's label;
 * 4. a `SYSTEM` alert: the Core's own message; any fault kind: `common.faultKind.<kind>`.
 */
import { SEAL_UNSEALABLE_PLAIN_SENTENCE, isUnsealableAlert, type SimAlert } from '@dems/shared/sim';
import { captureFaultLine, captureNoticeTitle, type FailedStart, type NoticeTranslate } from '@/features/capture-selector/capture-notices-model';
import { failedStartAlertLabel } from '@/features/dashboard/home-model';

export function alertLabel(t: NoticeTranslate, alert: SimAlert, failedStart: FailedStart | null): string {
  if (isUnsealableAlert(alert)) {
    const sessionId = alert.params?.['sessionId'];
    return t('features.session-finalizing.openNotice.alertLine', { sessionId: typeof sessionId === 'string' ? sessionId : (alert.target ?? ''), sentence: SEAL_UNSEALABLE_PLAIN_SENTENCE });
  }
  return (
    failedStartAlertLabel(t, alert, failedStart) ??
    captureFaultLine(t, alert) ??
    captureNoticeTitle(t, alert) ??
    (alert.kind === 'SYSTEM' ? alert.message : t(`common.faultKind.${alert.kind}`, { defaultValue: alert.message }))
  );
}
