/**
 * What the export wizard makes of the Core's answers (settle sites A5, C-5 and D-6 of backend task
 * 04_client_integration_spec §8.2, §8.4; plan row W69). Pure: no React, no store.
 *
 * | Answer | Where the wizard shows it |
 * |--------|---------------------------|
 * | `202` | The row's result: accepted, with the export ID the Core gave and the audit row of the export, read from the replica (C-5: the row is in a revision at or below the answer's) |
 * | `403` for every row (Live mode) | The wizard's denied Alert on the Authorise step; the Core wrote one `EXPORT_DENIED` row per call |
 * | `422 INVALID_REASON` and nothing accepted (Live mode) | Back on the Reason step, with the reason kept and the field saying that the Core refused it (F59: the form keeps its bounds, the Core is the judge) |
 * | `404`, `409`, another `422` | The row's result with the existing failure sentence of its reason |
 * | No answer: an outage, a time-out, a limit (Live mode) | The refusal presenter's toast (coalesced), and the row's result in the failure state with the presenter's own sentence (LB-6, LB-7, LB-10): this page writes no "unreachable" or "limited" sentence of its own |
 */
import type { TFunction } from 'i18next'
import type { ExportResult } from '@dems/shared/sim'
import { CoreErrorNoticeKind, type CoreErrorNotice } from '@/lib/core-errors'

export interface ExportOutcome {
  rowId: string
  /** The action's result; `null` when the Core gave no result (Live mode: no answer, or a rejection). */
  result: ExportResult | null
  auditRowId: string | null
  auditHash: string | null
  exportedAt: number
  /** The sentence shown in place of the result's reason, when `result` is `null`. */
  failureText: string | null
}

/** The sentence of a rejected export, by the presenter's notice (its own words, never this page's). */
export function exportFailureText(t: TFunction, notice: CoreErrorNotice | null): string {
  switch (notice?.kind) {
    case CoreErrorNoticeKind.LIMIT:
      return notice.seconds === null ? t('common.coreErrors.limitedNoTime') : t('common.coreErrors.limited', { seconds: notice.seconds })
    case CoreErrorNoticeKind.NOT_SENT:
      return t('common.coreErrors.notSent')
    case CoreErrorNoticeKind.TIMED_OUT:
      return t('common.coreErrors.timedOut')
    case CoreErrorNoticeKind.STARTING:
      return t('common.coreErrors.starting')
    case CoreErrorNoticeKind.OFFLINE:
      return t('common.coreErrors.offline')
    case CoreErrorNoticeKind.UNAVAILABLE:
      return t('common.coreErrors.unavailable')
    case CoreErrorNoticeKind.SIGNED_OUT:
      return t('evidence.exportWizard.failure.NOT_SIGNED_IN')
    case CoreErrorNoticeKind.PERMISSION:
      return t('evidence.exportWizard.failure.FORBIDDEN')
    case CoreErrorNoticeKind.NOT_AVAILABLE:
      return t('common.coreErrors.notAvailable')
    default:
      return t('evidence.live.export.notCompleted')
  }
}

const isRefusal = (result: ExportResult | null, reason: string): boolean => result !== null && !result.ok && result.reason === reason

/** A5, D-6: every answer was the Core's 403, so the wizard shows its denied Alert. */
export function everyExportDenied(results: readonly (ExportResult | null)[]): boolean {
  return results.length > 0 && results.every((result) => isRefusal(result, 'FORBIDDEN'))
}

/** A5: the Core refused the reason and accepted nothing: the wizard goes back to the Reason step. */
export function reasonRefused(results: readonly (ExportResult | null)[]): boolean {
  return !results.some((result) => result?.ok === true) && results.some((result) => isRefusal(result, 'INVALID_REASON'))
}

/**
 * D-6, Live mode: whether the Core let any call of the denied path past its identity and permission
 * checks (an answer other than a 401, a 403 or no answer). The console's permission hint was then
 * out of date (a role changed meanwhile), and the Core's answers are shown as the export's result.
 */
export function anyExportPastGuard(results: readonly (ExportResult | null)[]): boolean {
  return results.some((result) => result !== null && !isRefusal(result, 'FORBIDDEN') && !isRefusal(result, 'NOT_SIGNED_IN'))
}
