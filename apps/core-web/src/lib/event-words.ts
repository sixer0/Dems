/**
 * THE TITLE OF AN EVENT IN AN ACTIVITY LIST (fix wave J, driver J-W; finding JW-03, truth rule 3d;
 * `contract_wave_j.md` J-S 3). The request row of an export JOB and its completion carry the same
 * event type (`EVIDENCE_EXPORTED`); the Core now states `params.exportPhase`. A list that worded both
 * "Evidence exported" said three exports for one, and one for a job that failed. One reader for the
 * Storage activity, the Network & Time events and the Dashboard's recent events:
 *
 * | `exportPhaseOfEvent(event)` | Title |
 * |---|---|
 * | `REQUESTED` | "Export requested" |
 * | `COMPLETED`, or null (an event without the member: the simulator's own completed export) | the type's own title ("Evidence exported") |
 */
import type { TFunction } from 'i18next'
import { exportPhaseOfEvent, type SimEvent } from '@dems/shared/sim'

export function eventTitle(t: TFunction, event: Pick<SimEvent, 'type' | 'params'>): string {
  if (exportPhaseOfEvent(event) === 'REQUESTED') return t('web.waveJ.events.exportRequested')
  return t(`common.eventType.${event.type}`)
}
