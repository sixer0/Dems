import { Button, Spinner, toast } from '@heroui/react'
import { RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { settle, useCoreActions } from '@dems/shared/live'
import { SEAL_AUTOMATIC_RETRIES, canRetryBlockedSeal, selectOperator, useSim } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import { logSessionMonitorError } from './log'

/**
 * Fix wave L (G75d-02, ruling D228 (1); `contract_wave_l.md` section 2): THE RETRY OF A BLOCKED SEAL.
 *
 * The Core runs a seal once at the stop and `SEAL_AUTOMATIC_RETRIES` (3) more times by itself; then
 * the seal is BLOCKED and the Core runs it again ONLY at a start of the Core or when operation 33
 * (`recoverSession`) is sent - it does not retry when the cause heals. Until this wave no screen
 * offered that operation: the session stayed blocked until it was sent through the API.
 *
 * | Who | What the control is |
 * |---|---|
 * | a role that holds the permission of operation 33 (`canRetryBlockedSeal`: investigator, supervisor) | the button "Retry sealing" - operation 33 |
 * | any other role | no button; the sentence says who can |
 *
 * Both read the two true sentences: "Sealing stopped after 3 automatic retries." and "An
 * investigator or a supervisor can retry." A refused retry goes to the shared presenter first (a
 * 403, an outage), else to the page's own toast; the seal's own progress then says what happened.
 * `place`: `banner` (one compact line beside the banner) or `dialog` (the sentences, then the button).
 */
export function SealRetryControl({ place }: { place: 'banner' | 'dialog' }) {
  const { t } = useTranslation()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const { busy, pending, run } = usePendingControl()
  const role = useSim((s) => selectOperator(s)?.role ?? null)
  const sessionId = useSim((s) => s.session?.id ?? null)
  const mayRetry = canRetryBlockedSeal(role)

  const retry = () =>
    run((release) => {
      settle(() => actions.recover(), {
        ok: () => {
          toast.success(t('web.waveL.sealRetry.sent'))
        },
        fail: (error) => {
          logSessionMonitorError('sealRetry', error, { sessionId })
          if (presentCoreError(error) !== null) return
          toast.danger(t('web.waveL.sealRetry.refused'))
        },
        done: release,
      })
    })

  const button = mayRetry ? (
    <Button size="sm" variant={place === 'banner' ? 'danger-soft' : 'primary'} onPress={retry} isDisabled={busy} isPending={pending} data-testid={`sm-seal-retry-${place}`} data-busy={busy || undefined}>
      {pending ? <Spinner size="sm" color="current" /> : <RotateCw className="size-4" aria-hidden="true" />}
      {pending ? t('web.waveL.sealRetry.pending') : t('web.waveL.sealRetry.action')}
    </Button>
  ) : null

  if (place === 'banner') {
    return (
      <span className="sm-banner-cta sm-seal-retry" data-testid="sm-seal-retry" data-may-retry={mayRetry ? 'true' : 'false'} aria-busy={busy || undefined}>
        <span className="sm-seal-retry-text" data-testid="sm-seal-retry-who-banner">
          {t('web.waveL.sealRetry.stopped', { count: SEAL_AUTOMATIC_RETRIES })} {t('web.waveL.sealRetry.whoCan')}
        </span>
        {button}
      </span>
    )
  }
  return (
    <div className="sm-seal-retry-dialog" data-testid="sm-seal-retry" data-may-retry={mayRetry ? 'true' : 'false'} aria-busy={busy || undefined}>
      <p data-testid="sm-seal-retry-stopped">{t('web.waveL.sealRetry.stopped', { count: SEAL_AUTOMATIC_RETRIES })}</p>
      <p data-testid="sm-seal-retry-who-dialog">
        {t('web.waveL.sealRetry.whoCan')} {mayRetry ? t('web.waveL.sealRetry.youCan') : null}
      </p>
      {button}
    </div>
  )
}
