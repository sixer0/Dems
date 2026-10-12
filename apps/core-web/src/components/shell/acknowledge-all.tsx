import { AlertDialog, Button, Spinner } from '@heroui/react'
import { CheckCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAcknowledgeAll, type AcknowledgeAllControl, type AcknowledgeAllSurface } from './use-acknowledge-all'

/** The control of "Acknowledge all" (`use-acknowledge-all.ts`): its count, or "n of N" while the run is under way. Nothing below the minimum. */
export function AcknowledgeAllButton({ control }: { control: AcknowledgeAllControl }) {
  const { t } = useTranslation()
  if (!control.offered) return null
  const { progress, plan } = control
  return (
    <Button size="sm" variant="outline" className="dems-alert-ack-all" isDisabled={progress !== null} isPending={progress !== null} onPress={control.ask} data-testid={`acknowledge-all-${control.surface}`} data-count={plan.alertIds.length}>
      {progress !== null ? <Spinner size="sm" color="current" aria-hidden="true" /> : <CheckCheck className="size-4" aria-hidden="true" />}
      {progress !== null ? t('web.waveJ3.ackAll.progress', { done: progress.done, total: progress.total }) : t('web.waveJ3.ackAll.action', { count: plan.alertIds.length })}
    </Button>
  )
}

/** The confirmation of "Acknowledge all": it names the count and how many notices of recordings that could not be sealed are LEFT for individual acknowledgement (they are never in "all", for any role - fix wave J closing pass, item 1). Rendered outside any popover. */
export function AcknowledgeAllDialog({ control }: { control: AcknowledgeAllControl }) {
  const { t } = useTranslation()
  const { confirming } = control
  const count = (confirming ?? control.plan).alertIds.length
  return (
    <AlertDialog.Backdrop isOpen={confirming !== null} onOpenChange={(open) => (open ? undefined : control.cancel())}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog aria-label={t('web.waveJ3.ackAll.confirmTitle', { count })} data-testid="acknowledge-all-confirm">
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning" />
            <AlertDialog.Heading>{t('web.waveJ3.ackAll.confirmTitle', { count })}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p data-testid="acknowledge-all-confirm-body">{t('web.waveJ3.ackAll.confirmBody', { count })}</p>
            {confirming !== null && confirming.leftNotices > 0 ? (
              <p className="mt-2" data-testid="acknowledge-all-confirm-left">
                {t('web.waveJ3.ackAll.confirmLeft', { count: confirming.leftNotices })}
              </p>
            ) : null}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="ghost" onPress={control.cancel} data-testid="acknowledge-all-cancel">
              {t('common.actions.cancel')}
            </Button>
            <Button variant="primary" onPress={control.confirm} data-testid="acknowledge-all-confirm-action">
              {t('web.waveJ3.ackAll.confirmAction', { count })}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}

/** Both parts in place, for a surface that is not inside a popover (the Alerts page). */
export function AcknowledgeAllAlerts({ surface }: { surface: AcknowledgeAllSurface }) {
  const control = useAcknowledgeAll(surface)
  return (
    <>
      <AcknowledgeAllButton control={control} />
      <AcknowledgeAllDialog control={control} />
    </>
  )
}
