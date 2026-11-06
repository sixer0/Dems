/**
 * THE ALERTS THAT ARE STILL OPEN FOR THE OPERATOR (fix wave J; findings JA2-25 / JW-21; the controller's
 * ruling: the web's bell agrees with the phone's - `implementation/170_fix_wave_j_p.md`, decision 6).
 *
 * | An alert | In the bell |
 * |---|---|
 * | active (acknowledged or not) | listed |
 * | resolved by the Core, acknowledged by nobody | listed, tagged "resolved, not acknowledged", and it can be acknowledged |
 * | resolved and acknowledged | closed: not listed |
 *
 * The badge counts the UNACKNOWLEDGED alerts of that list. Before, the bell counted and listed active
 * alerts only: an alert the Core cleared left the bell although nobody had acknowledged it (lane 1:
 * twelve such alerts under a bell that said "Notifications").
 */
import { isUnsealableAlert, type SimAlert, type SimState } from '@dems/shared/sim'

/** The newest open alerts the bell lists (in a scroll). */
export const OPEN_ALERTS_LISTED = 20

export function isOpenAlert(alert: Pick<SimAlert, 'active' | 'acknowledged'>): boolean {
  return alert.active || !alert.acknowledged
}

/** Open alerts, newest first, at most `OPEN_ALERTS_LISTED`. The alert objects are the store's own. */
export function openAlertsOf(alerts: readonly SimAlert[]): SimAlert[] {
  return alerts
    .filter(isOpenAlert)
    .sort((a, b) => b.at - a.at)
    .slice(0, OPEN_ALERTS_LISTED)
}

/** The badge: every open alert nobody acknowledged (not only the listed twenty). A primitive. */
export function selectOpenUnacknowledgedCount(s: Pick<SimState, 'alerts'>): number {
  let count = 0
  for (const alert of s.alerts) if (!alert.acknowledged) count += 1
  return count
}

/**
 * WHAT "ACKNOWLEDGE ALL" ACKNOWLEDGES (fix wave J round three, driver J3-W; the web's side of the bell
 * that read "84 new alerts" after the counting rule changed). One press, one confirmation that names
 * the count, then ONE request per alert through the existing operation 70 - no new operation.
 *
 * | An alert | In "all" |
 * |---|---|
 * | not acknowledged, active or resolved by the Core | yes |
 * | acknowledged | no (nothing to do) |
 * | the notice of a recording that could not be sealed (UNSEALABLE) | NEVER, for any role (the controller's ruling, fix wave J closing pass): a notice about a recording in quarantine is closed one by one, knowingly, on its own row. The open ones are counted as `leftNotices` and the confirmation names that count |
 *
 * A notice is "open" while it is active (acknowledged by a non-reviewing role or not) or not yet
 * acknowledged. Oldest first: the backlog is cleared in the order it arose. Pure, and the same for
 * every role - which is why it takes no role.
 */
export interface AcknowledgeAllPlan {
  /** The ids to send, oldest first. Never the id of an unsealable notice. */
  readonly alertIds: readonly string[]
  /** Open unsealable notices, left for individual acknowledgement. */
  readonly leftNotices: number
}

export function acknowledgeAllPlan(alerts: readonly SimAlert[]): AcknowledgeAllPlan {
  const targets: SimAlert[] = []
  let leftNotices = 0
  for (const alert of alerts) {
    if (isUnsealableAlert(alert)) {
      if (alert.active || !alert.acknowledged) leftNotices += 1
      continue
    }
    if (!alert.acknowledged) targets.push(alert)
  }
  targets.sort((a, b) => a.at - b.at)
  return { alertIds: targets.map((alert) => alert.id), leftNotices }
}
