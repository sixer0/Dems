/**
 * The archive action of the Evidence page (settle site B-1 of backend task
 * 04_client_integration_spec §8.3; LB-1, LB-3, LB-5, LB-6, LB-10; AC-C-48; plan row W69).
 *
 * One hook for both places that offer it: the row menu of the list (`list-page.tsx`) and the
 * "More" menu of the detail header (`detail-page.tsx`). The action goes through
 * `useCoreActions()` and `settle`, so the call site reads the same in both data modes:
 *
 * | Outcome | Simulated mode (unchanged) | Live mode |
 * |---------|----------------------------|-----------|
 * | Success | the toast at once | the toast after the Core answered `204`; the status chip has morphed already (the delta of the answer's revision is applied first, CL-16; M-C-10) |
 * | 403 `NOT_PERMITTED` | not reachable: the menu item is disabled for a role without `EVIDENCE_REVIEW` | the refusal presenter's denied toast, naming the Supervisor role (AC-C-48); the Core wrote one `ACCESS_DENIED` row |
 * | 409 `NOT_SEALED` (`SimTransitionError`) | the existing not-sealed warning | the same warning |
 * | Outage, time-out, 429 | — | the presenter's own sentence (LB-6, LB-7, LB-10): never a sentence of this page |
 * | Anything else | the existing failure toast and one record | the same |
 *
 * Every error goes to the presenter first (rule 2 of the page rows). While the archive is out the
 * caller's container carries `aria-busy` and a second press is ignored (`usePendingControl`); the
 * menu itself closes at the press (the kit's `Dropdown` does that on every action).
 */
import { useCallback } from 'react'
import { toast } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { settle, useCoreActions } from '@dems/shared/live'
import { SimTransitionError } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl, type PendingControl } from '@/lib/pending-control'
import { logEvidenceError, newCorrelationId } from './log'

export interface ArchiveAction {
  /** Archives one item; ignored while an archive is out. `source` names the call site in a record. */
  readonly archive: (evidenceId: string, source: 'list' | 'detail') => void
  readonly control: PendingControl
}

export function useArchiveEvidence(): ArchiveAction {
  const { t } = useTranslation()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const control = usePendingControl()
  const { run } = control

  const archive = useCallback(
    (evidenceId: string, source: 'list' | 'detail') => {
      run((release) => {
        settle(() => actions.archiveEvidence(evidenceId), {
          ok: () => {
            toast.success(t('evidence.archive.success', { id: evidenceId }))
          },
          fail: (error) => {
            if (presentCoreError(error) !== null) return
            if (error instanceof SimTransitionError) {
              toast.warning(t('evidence.archive.notSealed'))
              return
            }
            logEvidenceError(`${source}.archive`, error, { evidenceId, correlationId: newCorrelationId('archive') })
            toast.danger(t('evidence.archive.failed'))
          },
          done: release,
        })
      }, evidenceId)
    },
    [actions, presentCoreError, run, t],
  )

  return { archive, control }
}
