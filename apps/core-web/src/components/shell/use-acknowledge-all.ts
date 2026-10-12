import { useMemo, useRef, useState } from 'react'
import { toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { settle, useCoreActions } from '@dems/shared/live'
import { useSim, type SimState } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { acknowledgeAllPlan, type AcknowledgeAllPlan } from './open-alerts'
import { reportShellError } from './shell-report'

const selectAlerts = (s: SimState) => s.alerts

/** Offered from this many alerts on: one alert has its own "Acknowledge" on its row. */
export const ACKNOWLEDGE_ALL_MIN = 2

export type AcknowledgeAllSurface = 'bell' | 'page'

export interface AcknowledgeAllControl {
  readonly surface: AcknowledgeAllSurface
  /** What a press would acknowledge now. */
  readonly plan: AcknowledgeAllPlan
  /** The control is drawn: enough alerts, or a run is under way. */
  readonly offered: boolean
  /** The plan the operator is asked to confirm; `null`: no confirmation is open. */
  readonly confirming: AcknowledgeAllPlan | null
  /** A run under way: how many of how many are acknowledged. */
  readonly progress: { readonly done: number; readonly total: number } | null
  readonly ask: () => void
  readonly cancel: () => void
  readonly confirm: () => void
}

/**
 * "ACKNOWLEDGE ALL" - the state and the run (fix wave J round three, driver J3-W): the way to clear a
 * backlog of alerts. Lane 2's bell read "84 new alerts" once it counted every alert nobody
 * acknowledged, and 84 single presses are not a way to work. Offered to every signed-in role
 * (operation 70 is open to all of them) on the bell and on the Alerts page, when at least
 * `ACKNOWLEDGE_ALL_MIN` alerts are in the plan (`acknowledgeAllPlan`, `open-alerts.ts`).
 *
 * | Step | What happens |
 * |------|--------------|
 * | One press (`ask`) | a confirmation that NAMES THE COUNT, says that the faults behind the alerts are not cleared, and says how many notices of recordings that could not be sealed are LEFT for individual acknowledgement (they are never in "all", for any role) |
 * | `confirm` | ONE request per alert through the existing operation 70, one after the other, oldest first; the control shows "n of N" |
 * | An alert is refused or the Core does not answer | the run STOPS there: the presenter words the cause (limit, outage, session end), ONE record goes to the console's log, and a toast says how many were acknowledged - never "all" |
 * | Done | a toast with the count |
 *
 * The ids are fixed at the press: what the confirmation names is what is sent, and an alert that
 * arrives while the dialog is open or the run is under way is not swept up unseen.
 *
 * The state lives in the component that calls this hook - for the bell that is the bell itself, not
 * its popover, which closes when the confirmation opens (`onAsk`): the confirmation and the run
 * outlive it. The two views are `AcknowledgeAllButton` and `AcknowledgeAllDialog` (`acknowledge-all.tsx`).
 */
export function useAcknowledgeAll(surface: AcknowledgeAllSurface, onAsk?: () => void): AcknowledgeAllControl {
  const { t } = useTranslation()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const alerts = useSim(selectAlerts)
  const plan = useMemo(() => acknowledgeAllPlan(alerts), [alerts])
  const [confirming, setConfirming] = useState<AcknowledgeAllPlan | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const running = useRef(false)

  const finish = (done: number, total: number, error?: unknown) => {
    running.current = false
    setProgress(null)
    if (error === undefined) {
      toast.success(t('web.waveJ3.ackAll.done', { count: done }))
      return
    }
    // The presenter first (limit, outage, session end); the console's own words and record for the rest.
    const presented = presentCoreError(error) !== null
    reportShellError('AcknowledgeAll.acknowledge', error, 'An acknowledgement of the run "Acknowledge all" was not accepted; the run stopped', { surface, done, total })
    const partial = t('web.waveJ3.ackAll.partial', { done, total })
    if (presented) toast.warning(partial)
    else toast.danger(partial, { description: t('web.waveJ3.ackAll.partialBody') })
  }

  const confirm = () => {
    const confirmed = confirming
    setConfirming(null)
    if (confirmed === null || running.current) return
    running.current = true
    const ids = confirmed.alertIds
    const total = ids.length
    setProgress({ done: 0, total })
    // One request per alert, in order: the next one is started in `ok` of the one before (`settle` nests).
    const step = (index: number) => {
      const alertId = ids[index]
      if (alertId === undefined) {
        finish(total, total)
        return
      }
      settle(() => actions.acknowledgeAlert(alertId), {
        ok: () => {
          setProgress({ done: index + 1, total })
          step(index + 1)
        },
        fail: (error) => finish(index, total, error),
      })
    }
    step(0)
  }

  return {
    surface,
    plan,
    offered: progress !== null || plan.alertIds.length >= ACKNOWLEDGE_ALL_MIN,
    confirming,
    progress,
    ask: () => {
      if (running.current) return
      onAsk?.()
      setConfirming(plan)
    },
    cancel: () => setConfirming(null),
    confirm,
  }
}
