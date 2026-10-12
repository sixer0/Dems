import type { RefObject } from 'react'
import { AlertDialog, Button, Spinner } from '@heroui/react'
import { useTranslation } from 'react-i18next'

export interface CancelDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  /**
   * Live mode (plan row W64, B-6, LB-1): the cancel request is in flight for longer than the
   * reveal time. The confirm button shows the kit's pending state; the dialog stays open until the
   * Core answered. Never true in Simulated mode.
   */
  confirmPending?: boolean
  /** The confirm button's element (`aria-busy` while the cancel request is in flight). */
  confirmRef?: RefObject<HTMLButtonElement | null>
}

/** "Discard this session?" (04 §5.7: cancelling after data entry opens an AlertDialog). */
export function CancelDialog({ isOpen, onOpenChange, onConfirm, confirmPending = false, confirmRef }: CancelDialogProps) {
  const { t } = useTranslation()
  // Fix wave J (JW-16): Escape did nothing here while it closed every other dialog; it now answers "Keep editing".
  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} isKeyboardDismissDisabled={false}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog aria-label={t('sessionNew.cancelDialog.title')} data-testid="sn-cancel-dialog">
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{t('sessionNew.cancelDialog.title')}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p className="sn-dialog-body">{t('sessionNew.cancelDialog.body')}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="ghost" onPress={() => onOpenChange(false)} data-testid="sn-cancel-keep">
              {t('sessionNew.cancelDialog.keep')}
            </Button>
            <Button ref={confirmRef} variant="danger" onPress={onConfirm} isPending={confirmPending} data-testid="sn-cancel-confirm">
              {confirmPending ? <Spinner size="sm" color="current" aria-hidden="true" /> : null}
              {t('sessionNew.cancelDialog.confirm')}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
