import { useTranslation } from 'react-i18next'
import { useInterruptedSeal } from './use-interrupted-seal'

/**
 * The status line of the seal dialog: the title, the cause, what the evidence holds. Draws nothing for any other session.
 *
 * Fix wave K (G75c-10): "Sealed — recording was interrupted" is said once the session IS sealed.
 * While the seal still runs (the dialog reads "0% complete") nothing is sealed yet: the line says the
 * recording was interrupted, its cause, and that the Core is sealing what was recorded.
 */
export function InterruptedSealNotice({ sessionId, sealed = true }: { sessionId: string | null; sealed?: boolean }) {
  const { t } = useTranslation()
  const words = useInterruptedSeal(sessionId)
  if (words === null) return null
  return (
    <p className="sm-final-incomplete" role="status" data-testid="sm-interrupted-seal" data-sealed={sealed ? 'true' : 'false'}>
      {sealed ? `${words.title}. ${words.cause} ${words.kept}` : `${t('web.interrupted.sealingTitle')}. ${words.cause} ${t('web.interrupted.sealingKept')}`}
    </p>
  )
}
