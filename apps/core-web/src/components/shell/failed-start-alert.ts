import type { TFunction } from 'i18next'
import type { SimAlert } from '@dems/shared/sim'
import { NO_CAMERA_CONNECTED_REASON, captureFailedStartText, type CaptureFailedStart } from '@/lib/capture-notices'

/**
 * The alert-centre line of a `CAPTURE_FAULT` alert that belongs to a FAILED START (integration pass D7
 * item 3; ux §8e.1 "told apart by reason", §8e.2 situation C), or `null` for any other alert:
 *
 * | The alert | The line |
 * |---|---|
 * | carries `params.reason: NO_CAMERA_CONNECTED` | "No camera connected. Nothing was recorded." |
 * | is active, names no cause, and the open session is a failed start | "Recording did not start. Nothing was recorded." |
 * | anything else | `null`: the alert keeps its own text |
 */
export function failedStartAlertLine(
  t: TFunction,
  alert: Pick<SimAlert, 'kind' | 'active' | 'params'>,
  failedStart: CaptureFailedStart | null,
): string | null {
  if (alert.kind !== 'CAPTURE_FAULT') return null
  const kind: CaptureFailedStart | null =
    alert.params?.['reason'] === NO_CAMERA_CONNECTED_REASON ? NO_CAMERA_CONNECTED_REASON : alert.active && failedStart !== null ? 'OTHER' : null
  if (kind === null) return null
  const text = captureFailedStartText(t, kind)
  return `${text.title}. ${text.body}`
}
