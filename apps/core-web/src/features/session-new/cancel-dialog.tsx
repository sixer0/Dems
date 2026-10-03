import { AlertDialog, Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'

export interface CancelDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/** "Discard this session?" (04 §5.7: cancelling after data entry opens an AlertDialog). */
export function CancelDialog({ isOpen, onOpenChange, onConfirm }: CancelDialogProps) {
  const { t } = useTranslation()
  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
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
            <Button variant="danger" onPress={onConfirm} data-testid="sn-cancel-confirm">
              {t('sessionNew.cancelDialog.confirm')}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}
